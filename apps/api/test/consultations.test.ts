import { beforeEach, describe, expect, it } from 'vitest';
import {
  DAY, app, auth, closeConsultation, db, kisumuWard, makeUser, openConsultation, outbox, request, resetDb,
} from './helpers.js';

const draft = (overrides: object = {}) => ({
  code: 'KSMFB26',
  type: 'FINANCE_BILL',
  countyId: 42,
  title: 'Kisumu County Finance Bill, 2026',
  summary: 'Proposes new fees for market stalls and parking in Kisumu town.',
  documentUrl: 'https://example.org/bill.pdf',
  opensAt: new Date(Date.now() + DAY).toISOString(),
  closesAt: new Date(Date.now() + 21 * DAY).toISOString(),
  ...overrides,
});

describe('consultation lifecycle', () => {
  beforeEach(resetDb);

  it('officers manage only their own county; national items need an admin', async () => {
    const { token: kisumu } = await makeUser('OFFICER', { countyId: 42 });
    await request(app).post('/api/consultations').set(auth(kisumu)).send(draft({ countyId: 47 })).expect(403);
    await request(app).post('/api/consultations').set(auth(kisumu)).send(draft({ countyId: null })).expect(403);
    await request(app).post('/api/consultations').set(auth(kisumu)).send(draft()).expect(201);

    const { token: citizen } = await makeUser();
    await request(app).post('/api/consultations').set(auth(citizen)).send(draft({ code: 'X1' })).expect(403);
  });

  it('refuses to publish without Kiswahili text or with too short a window', async () => {
    const { token } = await makeUser('OFFICER', { countyId: 42 });
    const created = await request(app)
      .post('/api/consultations')
      .set(auth(token))
      .send(draft({ closesAt: new Date(Date.now() + 5 * DAY).toISOString() }))
      .expect(201);
    const id = created.body.id;

    const res = await request(app).post(`/api/consultations/${id}/publish`).set(auth(token)).expect(422);
    expect(res.body.error).toMatch(/at least 14 days/);
    expect(res.body.error).toMatch(/Kiswahili/);

    // drafts are invisible to the public
    await request(app).get(`/api/consultations/${id}`).expect(404);

    await request(app)
      .patch(`/api/consultations/${id}`)
      .set(auth(token))
      .send({
        titleSw: 'Mswada wa Fedha wa Kaunti ya Kisumu, 2026',
        summarySw: 'Unapendekeza ada mpya za vibanda sokoni na maegesho.',
        closesAt: new Date(Date.now() + 21 * DAY).toISOString(),
      })
      .expect(200);
    const published = await request(app).post(`/api/consultations/${id}/publish`).set(auth(token)).expect(200);
    expect(published.body.phase).toBe('UPCOMING');
    await request(app).get(`/api/consultations/${id}`).expect(200);
  });

  it('accepts web submissions only while open and records the ward', async () => {
    const ward = await kisumuWard('Kondele');
    const { token, user } = await makeUser('CITIZEN', { wardId: ward.id });
    const c = await openConsultation();

    const res = await request(app)
      .post(`/api/consultations/${c.id}/submissions`)
      .set(auth(token))
      .send({ stance: 'AMEND', clause: 'Part III, s.12', body: 'Halve the boda boda parking fee.' })
      .expect(201);
    expect(res.body.reference).toMatch(/^S-[A-Z2-9]{6}$/);
    expect(res.body.wardId).toBe(ward.id);
    expect(outbox().at(-1)).toMatchObject({ to: user.phone });
    expect(outbox().at(-1)!.message).toContain(res.body.reference);

    await closeConsultation(c.id);
    await request(app)
      .post(`/api/consultations/${c.id}/submissions`)
      .set(auth(token))
      .send({ stance: 'SUPPORT', body: 'Too late?' })
      .expect(409);
  });

  it('closes the feedback loop: decisions with reasons, then a public report and SMS to every participant', async () => {
    const ward = await kisumuWard('Ahero');
    const a = await makeUser('CITIZEN', { wardId: ward.id });
    const b = await makeUser('CITIZEN');
    await db.user.update({ where: { id: b.user.id }, data: { language: 'SW' } });
    const officer = await makeUser('OFFICER', { countyId: 42 });
    const c = await openConsultation();

    const post = (token: string, body: string, stance = 'OPPOSE') =>
      request(app).post(`/api/consultations/${c.id}/submissions`).set(auth(token)).send({ stance, body });
    const s1 = (await post(a.token, 'Market fees too high for mama mbogas')).body;
    const s2 = (await post(b.token, 'Ada ya maegesho ni kubwa mno', 'AMEND')).body;

    // cannot report while still open
    await request(app).post(`/api/consultations/${c.id}/report`).set(auth(officer.token)).send({ summary: 'x'.repeat(30) }).expect(409);
    await closeConsultation(c.id);

    // the public cannot see the report before it is published
    await request(app).get(`/api/consultations/${c.id}/report`).expect(404);

    await request(app)
      .post(`/api/consultations/${c.id}/decisions`)
      .set(auth(officer.token))
      .send({ submissionIds: [s1.id], decision: 'ADOPTED' })
      .expect(200);

    // pending submission blocks publication
    const blocked = await request(app)
      .post(`/api/consultations/${c.id}/report`)
      .set(auth(officer.token))
      .send({ summary: 'The committee considered all memoranda received.' })
      .expect(422);
    expect(blocked.body.error).toMatch(/1 submission/);

    // rejecting without a reason is not allowed
    await request(app)
      .post(`/api/consultations/${c.id}/decisions`)
      .set(auth(officer.token))
      .send({ submissionIds: [s2.id], decision: 'NOT_ADOPTED' })
      .expect(400);
    await request(app)
      .post(`/api/consultations/${c.id}/decisions`)
      .set(auth(officer.token))
      .send({ submissionIds: [s2.id], decision: 'PARTIALLY_ADOPTED', reason: 'Fee reduced by 25%, not 50%.' })
      .expect(200);

    outbox().length = 0;
    await request(app)
      .post(`/api/consultations/${c.id}/report`)
      .set(auth(officer.token))
      .send({ summary: 'The committee considered all memoranda received.' })
      .expect(200);

    const report = (await request(app).get(`/api/consultations/${c.id}/report`).expect(200)).body;
    expect(report.totals).toEqual({ submissions: 2, participants: 2 });
    expect(report.byStance).toEqual({ OPPOSE: 1, AMEND: 1 });
    expect(report.bySubCounty).toEqual({ Nyando: 1, Unspecified: 1 });
    expect(JSON.stringify(report)).not.toContain(a.user.phone);

    const sent = outbox();
    expect(sent.map((m) => m.to).sort()).toEqual([a.user.phone, b.user.phone].sort());
    expect(sent.find((m) => m.to === a.user.phone)!.message).toContain('ADOPTED');
    expect(sent.find((m) => m.to === b.user.phone)!.message).toContain('IMEKUBALIWA KWA SEHEMU');

    const lookup = await request(app).get(`/api/submissions/${s2.reference}`).expect(200);
    expect(lookup.body).toMatchObject({ decision: 'PARTIALLY_ADOPTED', decisionReason: 'Fee reduced by 25%, not 50%.' });

    const log = await db.auditLog.findMany({ where: { entityId: c.id } });
    expect(log.map((l) => l.action)).toContain('consultation.report.publish');
  });
});
