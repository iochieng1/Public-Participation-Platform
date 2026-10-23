import request from 'supertest';
import { PrismaClient, type Role } from '@prisma/client';
import { createApp } from '../src/app.js';
import { signToken } from '../src/auth.js';
import { sms, type ConsoleSms } from '../src/sms.js';
import { seedGeography } from '../prisma/seed-geo.js';

export const app = createApp();
export const db = new PrismaClient();
export const outbox = () => (sms as ConsoleSms).outbox;
const DAY = 86_400_000;

export async function resetDb() {
  await db.$executeRawUnsafe(
    'TRUNCATE "AuditLog","IssueUpdate","IssueUpvote","Issue","Submission","Consultation","OtpCode","User" CASCADE',
  );
  if ((await db.ward.count()) === 0) await seedGeography(db);
  outbox().length = 0;
}

let n = 0;
export async function makeUser(role: Role = 'CITIZEN', extra: { countyId?: number; wardId?: string } = {}) {
  n += 1;
  const user = await db.user.create({ data: { phone: `+2547${String(10000000 + n)}`, role, ...extra } });
  return { user, token: signToken(user) };
}

export const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

export async function kisumuWard(name = 'Kondele') {
  return db.ward.findFirstOrThrow({ where: { name, subCounty: { countyId: 42 } } });
}

export async function openConsultation(overrides: Partial<Parameters<typeof db.consultation.create>[0]['data']> = {}) {
  const { user } = await makeUser('ADMIN');
  return db.consultation.create({
    data: {
      code: `T${++n}`,
      type: 'FINANCE_BILL',
      countyId: 42,
      title: 'Kisumu County Finance Bill, 2026',
      titleSw: 'Mswada wa Fedha wa Kaunti ya Kisumu, 2026',
      summary: 'Proposes new market and parking fees.',
      summarySw: 'Unapendekeza ada mpya.',
      documentUrl: 'https://example.org/bill.pdf',
      opensAt: new Date(Date.now() - DAY),
      closesAt: new Date(Date.now() + 14 * DAY),
      status: 'PUBLISHED',
      createdById: user.id,
      ...overrides,
    },
  });
}

export const closeConsultation = (id: string) =>
  db.consultation.update({ where: { id }, data: { closesAt: new Date(Date.now() - 1000) } });

export const ussd = (phoneNumber: string, text: string) =>
  request(app).post('/api/callbacks/ussd?token=test-token').type('form').send({ phoneNumber, text });

export const inboundSms = (from: string, text: string) =>
  request(app).post('/api/callbacks/sms?token=test-token').type('form').send({ from, text });

export { request, DAY };
