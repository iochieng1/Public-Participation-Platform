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
  // Demo content: the real Kisumu County Finance Bill, 2024 (Kenya Gazette Supplement No. 5,
  // Kisumu County Bills No. 3, 9 September 2024), reopened with current dates for demonstration.
  const finance2024 = {
    type: 'FINANCE_BILL' as const,
    countyId: 42,
    title: 'The Kisumu County Finance Bill, 2024',
    titleSw: 'Mswada wa Fedha wa Kaunti ya Kisumu, 2024',
    summary:
      'Sets the taxes, fees and charges the County Government of Kisumu collects. Its schedule lists the ' +
      '"new charges" for licences and permits, plot and house rent, cess and market fees, and trade licences. ' +
      'It also covers how payments are made to the county, and penalties for offences. Tell the County Assembly ' +
      'which charges you support, oppose or want changed. (Demo: this is the real 2024 Bill, used as sample content.)',
    summarySw:
      'Unaweka kodi, ada na tozo zinazokusanywa na Serikali ya Kaunti ya Kisumu. Jedwali lake linaorodhesha ' +
      '"tozo mpya" za leseni na vibali, kodi ya viwanja na nyumba, ushuru wa mazao (cess) na ada za soko, na ' +
      'leseni za biashara. Pia unaeleza jinsi malipo yanavyofanywa kwa kaunti, na adhabu za makosa. Liambie Bunge ' +
      'la Kaunti tozo unazounga mkono, unazopinga au unazotaka zibadilishwe. (Mfano: huu ni Mswada halisi wa 2024.)',
    documentUrl:
      'https://slo-countybills.go.ke/api/v1/bill/files/UA1RY4Z5QN_06_KISUMU%20COUNTY%20FINANCE%20BILL,%202024.pdf',
  };
  await prisma.consultation.upsert({
    where: { code: 'KSMFB24' },
    update: finance2024,
    create: {
      ...finance2024,
      code: 'KSMFB24',
      opensAt: new Date(now - day),
      closesAt: new Date(now + 20 * day),
      status: 'PUBLISHED',
      createdById: admin.id,
    },
  });
  console.log('Seeded 47 counties, Kisumu wards, demo users and the Kisumu Finance Bill 2024 demo.');
}

main().finally(() => prisma.$disconnect());
