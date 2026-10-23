import { beforeEach, describe, expect, it } from 'vitest';
import { app, auth, kisumuWard, outbox, request, resetDb } from './helpers.js';

const lastCode = () => /(\d{6})/.exec(outbox().at(-1)!.message)![1];

describe('phone OTP sign-in', () => {
  beforeEach(resetDb);

  it('signs a citizen in with the code sent by SMS and normalises the number', async () => {
    await request(app).post('/api/auth/otp/request').send({ phone: '0712 345 678' }).expect(202);
    expect(outbox().at(-1)!.to).toBe('+254712345678');

    const res = await request(app)
      .post('/api/auth/otp/verify')
      .send({ phone: '+254712345678', code: lastCode() })
      .expect(200);
    expect(res.body.user).toMatchObject({ phone: '+254712345678', role: 'CITIZEN' });

    const ward = await kisumuWard();
    await request(app).patch('/api/me').set(auth(res.body.token)).send({ wardId: ward.id, language: 'SW' }).expect(200);
    const me = await request(app).get('/api/me').set(auth(res.body.token)).expect(200);
    expect(me.body.ward.subCounty.county.name).toBe('Kisumu');
  });

  it('rejects a wrong code, and a used code cannot be replayed', async () => {
    await request(app).post('/api/auth/otp/request').send({ phone: '0712345678' });
    const code = lastCode();
    const wrong = code === '000000' ? '111111' : '000000';
    await request(app).post('/api/auth/otp/verify').send({ phone: '0712345678', code: wrong }).expect(401);
    await request(app).post('/api/auth/otp/verify').send({ phone: '0712345678', code }).expect(200);
    await request(app).post('/api/auth/otp/verify').send({ phone: '0712345678', code }).expect(401);
  });

  it('rate-limits code requests and rejects non-Kenyan numbers', async () => {
    for (let i = 0; i < 3; i++) await request(app).post('/api/auth/otp/request').send({ phone: '0712345678' }).expect(202);
    await request(app).post('/api/auth/otp/request').send({ phone: '0712345678' }).expect(429);
    await request(app).post('/api/auth/otp/request').send({ phone: '+255712345678' }).expect(400);
  });
});
