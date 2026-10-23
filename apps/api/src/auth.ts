import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import type { Role, User } from '@prisma/client';
import { config } from './config.js';
import { prisma } from './db.js';
import { HttpError } from './errors.js';
import { notify } from './sms.js';

const OTP_TTL_MS = 5 * 60_000;
const OTP_MAX_ATTEMPTS = 5;
const OTP_MAX_PER_WINDOW = 3;
const OTP_WINDOW_MS = 15 * 60_000;

const hashOtp = (phone: string, code: string) =>
  createHmac('sha256', config.jwtSecret).update(`${phone}:${code}`).digest('hex');

export async function requestOtp(phone: string) {
  const recent = await prisma.otpCode.count({
    where: { phone, createdAt: { gt: new Date(Date.now() - OTP_WINDOW_MS) } },
  });
  if (recent >= OTP_MAX_PER_WINDOW) throw new HttpError(429, 'Too many codes requested; try again later');

  const code = String(randomInt(100000, 1000000));
  await prisma.otpCode.create({
    data: { phone, codeHash: hashOtp(phone, code), expiresAt: new Date(Date.now() + OTP_TTL_MS) },
  });
  notify(phone, `Your Public Participation code is ${code}. / Nambari yako ya kuthibitisha ni ${code}.`);
}

export async function verifyOtp(phone: string, code: string): Promise<User> {
  const otp = await prisma.otpCode.findFirst({
    where: { phone, consumedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
  });
  if (!otp || otp.attempts >= OTP_MAX_ATTEMPTS) throw new HttpError(401, 'Invalid or expired code');

  const ok = timingSafeEqual(Buffer.from(otp.codeHash), Buffer.from(hashOtp(phone, code)));
  if (!ok) {
    await prisma.otpCode.update({ where: { id: otp.id }, data: { attempts: { increment: 1 } } });
    throw new HttpError(401, 'Invalid or expired code');
  }
  await prisma.otpCode.update({ where: { id: otp.id }, data: { consumedAt: new Date() } });
  return findOrCreateCitizen(phone);
}

export async function findOrCreateCitizen(phone: string) {
  return prisma.user.upsert({ where: { phone }, update: {}, create: { phone } });
}

export const signToken = (user: Pick<User, 'id'>) =>
  jwt.sign({ sub: user.id }, config.jwtSecret, { expiresIn: '7d' });

declare module 'express-serve-static-core' {
  interface Request {
    user?: User;
  }
}

/** Attaches req.user when a valid bearer token is present; never rejects. */
export async function loadUser(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    try {
      const { sub } = jwt.verify(header.slice(7), config.jwtSecret) as { sub: string };
      req.user = (await prisma.user.findUnique({ where: { id: sub } })) ?? undefined;
    } catch {
      // invalid token: treat as anonymous
    }
  }
  next();
}

export function currentUser(req: Request, ...roles: Role[]): User {
  if (!req.user) throw new HttpError(401, 'Sign in required');
  if (roles.length && !roles.includes(req.user.role)) throw new HttpError(403, 'Not permitted');
  return req.user;
}

/** Officers manage only their own county; admins manage national items and any county. */
export function assertCanManage(user: User, countyId: number | null) {
  if (user.role === 'ADMIN') return;
  if (user.role === 'OFFICER' && countyId !== null && user.countyId === countyId) return;
  throw new HttpError(403, 'You can only manage items in your own county');
}
