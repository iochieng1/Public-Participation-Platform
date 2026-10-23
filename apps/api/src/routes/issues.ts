import { Router } from 'express';
import { z } from 'zod';
import { currentUser } from '../auth.js';
import { prisma } from '../db.js';
import { h, notFound } from '../errors.js';
import { createIssue, respondToIssue, upvoteIssue } from '../services/issues.js';

export const issuesRouter = Router();

const category = z.enum(['WATER', 'ROADS', 'HEALTH', 'EDUCATION', 'SECURITY', 'WASTE', 'OTHER']);
const status = z.enum(['OPEN', 'ACKNOWLEDGED', 'IN_PROGRESS', 'RESOLVED', 'REJECTED']);

const wardWithPlace = { include: { subCounty: { include: { county: true } } } } as const;

issuesRouter.get(
  '/issues',
  h(async (req, res) => {
    const q = z
      .object({
        countyId: z.coerce.number().int().optional(),
        wardId: z.string().optional(),
        status: status.optional(),
        category: category.optional(),
      })
      .parse(req.query);
    const issues = await prisma.issue.findMany({
      where: {
        wardId: q.wardId,
        status: q.status,
        category: q.category,
        ward: q.countyId ? { subCounty: { countyId: q.countyId } } : undefined,
      },
      include: { ward: wardWithPlace },
      orderBy: [{ upvoteCount: 'desc' }, { createdAt: 'desc' }],
      take: 200,
    });
    res.json(issues.map(({ reporterId: _r, ...i }) => i));
  }),
);

issuesRouter.get(
  '/issues/:id',
  h(async (req, res) => {
    const issue = await prisma.issue.findUnique({
      where: { id: req.params.id },
      include: {
        ward: wardWithPlace,
        updates: { orderBy: { createdAt: 'asc' }, include: { author: { select: { name: true, role: true } } } },
      },
    });
    if (!issue) throw notFound('Issue');
    const { reporterId, ...rest } = issue;
    const upvoted = req.user
      ? !!(await prisma.issueUpvote.findUnique({ where: { issueId_userId: { issueId: issue.id, userId: req.user.id } } }))
      : false;
    res.json({ ...rest, upvoted, mine: req.user?.id === reporterId });
  }),
);

issuesRouter.post(
  '/issues',
  h(async (req, res) => {
    const user = currentUser(req);
    const input = z
      .object({
        wardId: z.string(),
        category,
        title: z.string().trim().min(5).max(120),
        description: z.string().trim().min(10).max(5000),
      })
      .parse(req.body);
    res.status(201).json(await createIssue({ ...input, user, channel: 'WEB' }));
  }),
);

issuesRouter.post(
  '/issues/:id/upvote',
  h(async (req, res) => {
    const user = currentUser(req);
    const issue = await upvoteIssue(req.params.id, user);
    res.json({ upvoteCount: issue.upvoteCount });
  }),
);

issuesRouter.post(
  '/issues/:id/updates',
  h(async (req, res) => {
    const user = currentUser(req, 'OFFICER', 'ADMIN');
    const input = z.object({ status, note: z.string().max(2000) }).parse(req.body);
    res.status(201).json(await respondToIssue(req.params.id, input.status, input.note, user));
  }),
);
