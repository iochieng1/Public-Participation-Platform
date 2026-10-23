import { Router, type Request } from 'express';
import { z } from 'zod';
import type { Consultation, User } from '@prisma/client';
import { assertCanManage, currentUser } from '../auth.js';
import { prisma } from '../db.js';
import { h, HttpError, notFound } from '../errors.js';
import {
  buildReport,
  createSubmission,
  decideSubmissions,
  phaseOf,
  publishConsultation,
  publishReport,
  withPhase,
} from '../services/consultations.js';

export const consultationsRouter = Router();

const canManage = (user: User | undefined, c: Pick<Consultation, 'countyId'>) => {
  if (!user) return false;
  try {
    assertCanManage(user, c.countyId);
    return true;
  } catch {
    return false;
  }
};

async function loadVisible(req: Request) {
  const c = await prisma.consultation.findUnique({ where: { id: req.params.id }, include: { county: true } });
  if (!c || (c.status === 'DRAFT' && !canManage(req.user, c))) throw notFound('Consultation');
  return c;
}

async function loadManaged(req: Request) {
  const user = currentUser(req, 'OFFICER', 'ADMIN');
  const c = await prisma.consultation.findUnique({ where: { id: req.params.id } });
  if (!c) throw notFound('Consultation');
  assertCanManage(user, c.countyId);
  return { user, c };
}

const consultationInput = z.object({
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{3,10}$/, '3–10 letters/digits, used as the SMS keyword'),
  type: z.enum(['BILL', 'FINANCE_BILL', 'BUDGET_ESTIMATES', 'CIDP', 'ADP', 'POLICY', 'OTHER']),
  countyId: z.number().int().min(1).max(47).nullable(),
  title: z.string().trim().min(5).max(200),
  titleSw: z.string().trim().max(200).optional(),
  summary: z.string().trim().min(20).max(4000),
  summarySw: z.string().trim().max(4000).optional(),
  documentUrl: z.string().url().optional(),
  opensAt: z.coerce.date(),
  closesAt: z.coerce.date(),
});

consultationsRouter.get(
  '/consultations',
  h(async (req, res) => {
    const q = z
      .object({ countyId: z.coerce.number().int().optional(), phase: z.string().optional() })
      .parse(req.query);
    const rows = await prisma.consultation.findMany({
      where: q.countyId ? { OR: [{ countyId: q.countyId }, { countyId: null }] } : {},
      include: { county: true, _count: { select: { submissions: true } } },
      orderBy: { closesAt: 'desc' },
    });
    res.json(
      rows
        .filter((c) => c.status !== 'DRAFT' || canManage(req.user, c))
        .map(withPhase)
        .filter((c) => !q.phase || c.phase === q.phase),
    );
  }),
);

consultationsRouter.get(
  '/consultations/:id',
  h(async (req, res) => {
    const c = await loadVisible(req);
    res.json({ ...withPhase(c), canManage: canManage(req.user, c) });
  }),
);

consultationsRouter.post(
  '/consultations',
  h(async (req, res) => {
    const user = currentUser(req, 'OFFICER', 'ADMIN');
    const input = consultationInput.parse(req.body);
    assertCanManage(user, input.countyId);
    if (input.closesAt <= input.opensAt) throw new HttpError(400, 'closesAt must be after opensAt');
    if (await prisma.consultation.findUnique({ where: { code: input.code } })) {
      throw new HttpError(409, `Code ${input.code} is already in use`);
    }
    const c = await prisma.consultation.create({ data: { ...input, createdById: user.id } });
    res.status(201).json(withPhase(c));
  }),
);

consultationsRouter.patch(
  '/consultations/:id',
  h(async (req, res) => {
    const { c } = await loadManaged(req);
    if (c.status !== 'DRAFT') throw new HttpError(409, 'Published consultations cannot be edited');
    const input = consultationInput.omit({ code: true, countyId: true }).partial().parse(req.body);
    res.json(withPhase(await prisma.consultation.update({ where: { id: c.id }, data: input })));
  }),
);

consultationsRouter.post(
  '/consultations/:id/publish',
  h(async (req, res) => {
    const { user, c } = await loadManaged(req);
    res.json(withPhase(await publishConsultation(c.id, user)));
  }),
);

consultationsRouter.post(
  '/consultations/:id/submissions',
  h(async (req, res) => {
    const user = currentUser(req);
    const consultation = await loadVisible(req);
    const input = z
      .object({
        stance: z.enum(['SUPPORT', 'OPPOSE', 'AMEND', 'GENERAL']),
        clause: z.string().trim().max(200).optional(),
        body: z.string().min(3).max(5000),
      })
      .parse(req.body);
    const s = await createSubmission({ consultation, user, channel: 'WEB', ...input });
    res.status(201).json(s);
  }),
);

consultationsRouter.get(
  '/consultations/:id/submissions',
  h(async (req, res) => {
    const { c } = await loadManaged(req);
    const rows = await prisma.submission.findMany({
      where: { consultationId: c.id },
      include: { ward: { include: { subCounty: true } }, user: { select: { name: true } } },
      orderBy: { createdAt: 'asc' },
    });
    res.json(rows);
  }),
);

consultationsRouter.post(
  '/consultations/:id/decisions',
  h(async (req, res) => {
    const { user, c } = await loadManaged(req);
    const input = z
      .object({
        submissionIds: z.array(z.string()).min(1),
        decision: z.enum(['ADOPTED', 'PARTIALLY_ADOPTED', 'NOT_ADOPTED']),
        reason: z.string().max(2000).optional(),
      })
      .parse(req.body);
    const updated = await decideSubmissions(c.id, input.submissionIds, input.decision, input.reason, user);
    res.json({ updated });
  }),
);

consultationsRouter.get(
  '/consultations/:id/report',
  h(async (req, res) => {
    const c = await loadVisible(req);
    if (c.status !== 'REPORT_PUBLISHED' && !canManage(req.user, c)) {
      throw new HttpError(404, 'The report has not been published yet');
    }
    res.json(await buildReport(c.id));
  }),
);

consultationsRouter.post(
  '/consultations/:id/report',
  h(async (req, res) => {
    const { user, c } = await loadManaged(req);
    const { summary } = z.object({ summary: z.string().trim().min(20).max(10000) }).parse(req.body);
    res.json(withPhase(await publishReport(c.id, summary, user)));
  }),
);

consultationsRouter.get(
  '/me/submissions',
  h(async (req, res) => {
    const user = currentUser(req);
    const rows = await prisma.submission.findMany({
      where: { userId: user.id },
      include: { consultation: { select: { id: true, title: true, titleSw: true, code: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(rows);
  }),
);

/** Public receipt lookup; returns no personal data. */
consultationsRouter.get(
  '/submissions/:reference',
  h(async (req, res) => {
    const s = await prisma.submission.findUnique({
      where: { reference: req.params.reference.toUpperCase() },
      include: { consultation: true },
    });
    if (!s) throw notFound('Submission');
    res.json({
      reference: s.reference,
      consultation: { id: s.consultation.id, title: s.consultation.title, phase: phaseOf(s.consultation) },
      stance: s.stance,
      decision: s.decision,
      decisionReason: s.decisionReason,
      createdAt: s.createdAt,
    });
  }),
);
