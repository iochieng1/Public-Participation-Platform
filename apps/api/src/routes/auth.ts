import { Router } from 'express';
import { z } from 'zod';
import { currentUser, requestOtp, signToken, verifyOtp } from '../auth.js';
import { prisma } from '../db.js';
import { h, HttpError } from '../errors.js';
import { normalizeKenyanPhone } from '../phone.js';

export const authRouter = Router();

const kenyanPhone = z.string().transform((v, ctx) => {
  const phone = normalizeKenyanPhone(v);
  if (!phone) ctx.addIssue({ code: 'custom', message: 'Enter a Kenyan mobile number, e.g. 0712 345 678' });
  return phone ?? '';
});

authRouter.post(
  '/auth/otp/request',
  h(async (req, res) => {
    const { phone } = z.object({ phone: kenyanPhone }).parse(req.body);
    await requestOtp(phone);
    res.status(202).json({ phone });
  }),
);

authRouter.post(
  '/auth/otp/verify',
  h(async (req, res) => {
    const { phone, code } = z.object({ phone: kenyanPhone, code: z.string().regex(/^\d{6}$/) }).parse(req.body);
    const user = await verifyOtp(phone, code);
    res.json({ token: signToken(user), user });
  }),
);

authRouter.get(
  '/me',
  h(async (req, res) => {
    const user = currentUser(req);
    const full = await prisma.user.findUnique({
      where: { id: user.id },
      include: { ward: { include: { subCounty: { include: { county: true } } } } },
    });
    res.json(full);
  }),
);

authRouter.patch(
  '/me',
  h(async (req, res) => {
    const user = currentUser(req);
    const body = z
      .object({
        name: z.string().trim().min(1).max(100).optional(),
        wardId: z.string().optional(),
        language: z.enum(['EN', 'SW']).optional(),
      })
      .parse(req.body);
    if (body.wardId && !(await prisma.ward.findUnique({ where: { id: body.wardId } }))) {
      throw new HttpError(400, 'Unknown ward');
    }
    res.json(await prisma.user.update({ where: { id: user.id }, data: body }));
  }),
);
