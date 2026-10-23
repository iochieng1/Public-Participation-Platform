import { Router } from 'express';
import { prisma } from '../db.js';
import { h, notFound } from '../errors.js';

export const geoRouter = Router();

geoRouter.get(
  '/counties',
  h(async (_req, res) => {
    const counties = await prisma.county.findMany({
      orderBy: { id: 'asc' },
      include: { _count: { select: { subCounties: true } } },
    });
    res.json(counties.map(({ _count, ...c }) => ({ ...c, live: _count.subCounties > 0 })));
  }),
);

geoRouter.get(
  '/counties/:id',
  h(async (req, res) => {
    const county = await prisma.county.findUnique({
      where: { id: Number(req.params.id) || 0 },
      include: {
        subCounties: { orderBy: { name: 'asc' }, include: { wards: { orderBy: { name: 'asc' } } } },
      },
    });
    if (!county) throw notFound('County');
    res.json(county);
  }),
);
