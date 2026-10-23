import { PrismaClient } from '@prisma/client';
import { seedGeography } from './seed-geo.js';

const prisma = new PrismaClient();

async function main() {
  await seedGeography(prisma);

  const admin = await prisma.user.upsert({
    where: { phone: '+254700000001' },
    update: {},
    create: { phone: '+254700000001', name: 'National Admin', role: 'ADMIN' },
  });
  await prisma.user.upsert({
    where: { phone: '+254700000042' },
    update: {},
    create: { phone: '+254700000042', name: 'Kisumu PP Officer', role: 'OFFICER', countyId: 42 },
  });

  const now = Date.now();
  const day = 86_400_000;
  await prisma.consultation.upsert({
    where: { code: 'KSMFB26' },
    update: {},
    create: {
      code: 'KSMFB26',
      type: 'FINANCE_BILL',
      countyId: 42,
      title: 'Kisumu County Finance Bill, 2026',
      titleSw: 'Mswada wa Fedha wa Kaunti ya Kisumu, 2026',
      summary:
        'Proposes new fees for market stalls, single business permits and parking within Kisumu town. Tell the County Assembly whether you support, oppose or want changes.',
      summarySw:
        'Unapendekeza ada mpya za vibanda sokoni, vibali vya biashara na maegesho ndani ya mji wa Kisumu. Iambie Bunge la Kaunti kama unaunga mkono, unapinga au unataka mabadiliko.',
      documentUrl: 'https://example.org/kisumu-finance-bill-2026.pdf',
      opensAt: new Date(now - day),
      closesAt: new Date(now + 20 * day),
      status: 'PUBLISHED',
      createdById: admin.id,
    },
  });
  console.log('Seeded 47 counties, Kisumu wards, demo users and a demo consultation.');
}

main().finally(() => prisma.$disconnect());
