import type { Channel, IssueCategory, IssueStatus, User } from '@prisma/client';
import { prisma } from '../db.js';
import { HttpError, notFound } from '../errors.js';
import { issueReceiptMessage, issueStatusText } from '../i18n.js';
import { newReference } from '../refs.js';
import { notify } from '../sms.js';
import { assertCanManage } from '../auth.js';
import { audit } from './consultations.js';

export async function createIssue(input: {
  user: User;
  wardId: string;
  category: IssueCategory;
  title: string;
  description: string;
  channel: Channel;
}) {
  const ward = await prisma.ward.findUnique({ where: { id: input.wardId } });
  if (!ward) throw notFound('Ward');
  const issue = await prisma.issue.create({
    data: {
      reference: newReference('I'),
      wardId: input.wardId,
      category: input.category,
      title: input.title.trim().slice(0, 120),
      description: input.description.trim().slice(0, 5000),
      channel: input.channel,
      reporterId: input.user.id,
    },
  });
  notify(input.user.phone, issueReceiptMessage(issue.reference, input.user.language));
  return issue;
}

export async function upvoteIssue(issueId: string, user: User) {
  const issue = await prisma.issue.findUnique({ where: { id: issueId } });
  if (!issue) throw notFound('Issue');
  const existing = await prisma.issueUpvote.findUnique({ where: { issueId_userId: { issueId, userId: user.id } } });
  if (existing) return issue;
  const [, updated] = await prisma.$transaction([
    prisma.issueUpvote.create({ data: { issueId, userId: user.id } }),
    prisma.issue.update({ where: { id: issueId }, data: { upvoteCount: { increment: 1 } } }),
  ]);
  return updated;
}

export async function respondToIssue(issueId: string, status: IssueStatus, note: string, actor: User) {
  const issue = await prisma.issue.findUnique({
    where: { id: issueId },
    include: { ward: { include: { subCounty: true } }, reporter: true },
  });
  if (!issue) throw notFound('Issue');
  assertCanManage(actor, issue.ward.subCounty.countyId);
  if (!note.trim()) throw new HttpError(400, 'A public note is required');

  const [update] = await prisma.$transaction([
    prisma.issueUpdate.create({ data: { issueId, authorId: actor.id, status, note: note.trim() } }),
    prisma.issue.update({ where: { id: issueId }, data: { status } }),
  ]);
  await audit(actor.id, 'issue.respond', issueId, { status });

  notify(
    issue.reporter.phone,
    `${issue.reference}: ${issueStatusText(status, issue.reporter.language)}. ${note.trim()}`,
  );
  return update;
}
