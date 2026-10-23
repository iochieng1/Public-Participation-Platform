import type { Channel, Consultation, Decision, Stance, User } from '@prisma/client';
import { config } from '../config.js';
import { prisma } from '../db.js';
import { HttpError, notFound } from '../errors.js';
import { decisionText, receiptMessage } from '../i18n.js';
import { newReference } from '../refs.js';
import { notify } from '../sms.js';

export type Phase = 'DRAFT' | 'UPCOMING' | 'OPEN' | 'CLOSED' | 'REPORTED';

export function phaseOf(c: Pick<Consultation, 'status' | 'opensAt' | 'closesAt'>, now = new Date()): Phase {
  if (c.status === 'DRAFT') return 'DRAFT';
  if (c.status === 'REPORT_PUBLISHED') return 'REPORTED';
  if (now < c.opensAt) return 'UPCOMING';
  if (now <= c.closesAt) return 'OPEN';
  return 'CLOSED';
}

export const withPhase = <T extends Consultation>(c: T) => ({ ...c, phase: phaseOf(c) });

/**
 * Publishing is where the platform enforces "meaningful" participation:
 * a minimum window, a plain-language summary in both official languages,
 * and the source document available to read.
 */
export async function publishConsultation(id: string, actor: User) {
  const c = await prisma.consultation.findUnique({ where: { id } });
  if (!c) throw notFound('Consultation');
  if (c.status !== 'DRAFT') throw new HttpError(409, 'Consultation is already published');

  const problems: string[] = [];
  const days = (c.closesAt.getTime() - c.opensAt.getTime()) / 86_400_000;
  if (days < config.minConsultationDays) {
    problems.push(`must stay open at least ${config.minConsultationDays} days (currently ${days.toFixed(1)})`);
  }
  if (c.closesAt <= new Date()) problems.push('closing date is in the past');
  if (!c.titleSw || !c.summarySw) problems.push('needs a Kiswahili title and summary');
  if (!c.documentUrl) problems.push('needs the full document attached');
  if (problems.length) throw new HttpError(422, `Cannot publish: ${problems.join('; ')}`);

  const updated = await prisma.consultation.update({ where: { id }, data: { status: 'PUBLISHED' } });
  await audit(actor.id, 'consultation.publish', id);
  return updated;
}

export async function createSubmission(input: {
  consultation: Consultation;
  user: User;
  channel: Channel;
  stance: Stance;
  clause?: string | null;
  body: string;
}) {
  const { consultation, user } = input;
  if (phaseOf(consultation) !== 'OPEN') throw new HttpError(409, 'This consultation is not open for comments');
  const body = input.body.trim();
  if (body.length < 3) throw new HttpError(400, 'Comment is too short');

  const submission = await prisma.submission.create({
    data: {
      reference: newReference('S'),
      consultationId: consultation.id,
      userId: user.id,
      channel: input.channel,
      stance: input.stance,
      clause: input.clause ?? null,
      body: body.slice(0, 5000),
      wardId: user.wardId,
    },
  });
  const title = user.language === 'SW' && consultation.titleSw ? consultation.titleSw : consultation.title;
  notify(user.phone, receiptMessage(submission.reference, title, user.language));
  return submission;
}

/** Records the county's response to one or more submissions (often grouped by theme). */
export async function decideSubmissions(
  consultationId: string,
  submissionIds: string[],
  decision: Exclude<Decision, 'PENDING'>,
  reason: string | undefined,
  actor: User,
) {
  const c = await prisma.consultation.findUnique({ where: { id: consultationId } });
  if (!c) throw notFound('Consultation');
  if (c.status === 'REPORT_PUBLISHED') throw new HttpError(409, 'Report already published');
  if (decision !== 'ADOPTED' && !reason?.trim()) {
    throw new HttpError(400, 'A reason is required when a submission is not fully adopted');
  }
  const { count } = await prisma.submission.updateMany({
    where: { id: { in: submissionIds }, consultationId },
    data: { decision, decisionReason: reason?.trim() || null, decidedAt: new Date(), decidedById: actor.id },
  });
  await audit(actor.id, 'submission.decide', consultationId, { submissionIds, decision, reason });
  return count;
}

export async function buildReport(consultationId: string) {
  const c = await prisma.consultation.findUnique({
    where: { id: consultationId },
    include: { county: true },
  });
  if (!c) throw notFound('Consultation');

  const submissions = await prisma.submission.findMany({
    where: { consultationId },
    include: { ward: { include: { subCounty: true } } },
    orderBy: { createdAt: 'asc' },
  });

  const tally = <K extends string>(key: (s: (typeof submissions)[number]) => K) =>
    submissions.reduce<Record<string, number>>((acc, s) => {
      const k = key(s);
      acc[k] = (acc[k] ?? 0) + 1;
      return acc;
    }, {});

  return {
    consultation: withPhase(c),
    totals: {
      submissions: submissions.length,
      participants: new Set(submissions.map((s) => s.userId)).size,
    },
    byStance: tally((s) => s.stance),
    byChannel: tally((s) => s.channel),
    byDecision: tally((s) => s.decision),
    bySubCounty: tally((s) => s.ward?.subCounty.name ?? 'Unspecified'),
    // Personal data (name, phone) is deliberately excluded: the report is public.
    submissions: submissions.map((s) => ({
      reference: s.reference,
      channel: s.channel,
      stance: s.stance,
      clause: s.clause,
      body: s.body,
      ward: s.ward?.name ?? null,
      subCounty: s.ward?.subCounty.name ?? null,
      decision: s.decision,
      decisionReason: s.decisionReason,
    })),
  };
}

/**
 * Closing the feedback loop: every submission must have a recorded decision
 * before the report goes out, and every participant is told the outcome by SMS.
 */
export async function publishReport(consultationId: string, reportSummary: string, actor: User) {
  const c = await prisma.consultation.findUnique({ where: { id: consultationId } });
  if (!c) throw notFound('Consultation');
  if (phaseOf(c) !== 'CLOSED') throw new HttpError(409, 'A report can only be published after the consultation closes');

  const pending = await prisma.submission.count({ where: { consultationId, decision: 'PENDING' } });
  if (pending > 0) throw new HttpError(422, `${pending} submission(s) still have no recorded decision`);

  const updated = await prisma.consultation.update({
    where: { id: consultationId },
    data: { status: 'REPORT_PUBLISHED', reportSummary, reportPublishedAt: new Date() },
  });
  await audit(actor.id, 'consultation.report.publish', consultationId);

  const submissions = await prisma.submission.findMany({ where: { consultationId }, include: { user: true } });
  const link = `${config.publicUrl}/consultations/${c.id}/report`;
  for (const s of submissions) {
    const lang = s.user.language;
    const msg =
      lang === 'SW'
        ? `Ripoti ya "${c.titleSw ?? c.title}" imechapishwa. Maoni yako ${s.reference}: ${decisionText(s.decision, lang)}. ${link}`
        : `Report on "${c.title}" published. Your submission ${s.reference}: ${decisionText(s.decision, lang)}. ${link}`;
    notify(s.user.phone, msg);
  }
  return updated;
}

export async function findOpenByCode(code: string) {
  const c = await prisma.consultation.findUnique({ where: { code: code.toUpperCase() } });
  return c && phaseOf(c) === 'OPEN' ? c : null;
}

export async function listOpenForCounty(countyId: number | null) {
  const now = new Date();
  return prisma.consultation.findMany({
    where: {
      status: 'PUBLISHED',
      opensAt: { lte: now },
      closesAt: { gte: now },
      OR: [{ countyId: null }, ...(countyId ? [{ countyId }] : [])],
    },
    orderBy: { closesAt: 'asc' },
  });
}

export async function audit(actorId: string | null, action: string, entityId: string, meta?: object) {
  await prisma.auditLog.create({
    data: { actorId, action, entity: action.split('.')[0], entityId, meta: meta ?? undefined },
  });
}
