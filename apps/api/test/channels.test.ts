import { beforeEach, describe, expect, it } from 'vitest';
import { closeConsultation, db, inboundSms, openConsultation, outbox, request, app, resetDb, ussd } from './helpers.js';

const PHONE = '0711222333';
const E164 = '+254711222333';

describe('USSD', () => {
  beforeEach(resetDb);

  it('rejects callbacks without the shared token', async () => {
    await request(app).post('/api/callbacks/ussd').type('form').send({ phoneNumber: PHONE, text: '' }).expect(403);
  });

  it('walks ward setup, a consultation comment and an issue report', async () => {
    const c = await openConsultation({ code: 'KSMFB26' });

    expect((await ussd(PHONE, '')).text).toMatch(/^CON .*1\. Open consultations/s);
    expect((await ussd(PHONE, '2')).text).toMatch(/^END .*set your ward/i);

    expect((await ussd(PHONE, '4*42')).text).toContain('Kisumu Central');
    expect((await ussd(PHONE, '4*1')).text).toMatch(/not on the platform/);
    expect((await ussd(PHONE, '4*42*1*1')).text).toBe('END Ward set: Kondele, Kisumu.');

    expect((await ussd(PHONE, '1')).text).toContain('Kisumu County Finance Bill');
    expect((await ussd(PHONE, '1*1')).text).toContain('2. Oppose');
    // a '*' typed inside the comment must not be lost
    const done = (await ussd(PHONE, '1*1*3*Cut fee to 50*bob')).text;
    expect(done).toMatch(/^END Thank you! Ref: S-/);

    const s = await db.submission.findFirstOrThrow({ where: { consultationId: c.id }, include: { ward: true } });
    expect(s).toMatchObject({ channel: 'USSD', stance: 'AMEND', body: 'Cut fee to 50*bob' });
    expect(s.ward?.name).toBe('Kondele');

    const issueDone = (await ussd(PHONE, '2*1*Borehole at Kondele market broken')).text;
    const ref = /I-\w{6}/.exec(issueDone)![0];
    expect((await ussd(PHONE, `3*${ref.replace('-', '')}`)).text).toMatch(/open\.$/);
    expect((await ussd(PHONE, `3*${s.reference}`)).text).toContain('under review');
  });

  it('switches to Kiswahili and stays there', async () => {
    expect((await ussd(PHONE, '5')).text).toBe('END Lugha imewekwa Kiswahili.');
    expect((await ussd(PHONE, '')).text).toContain('Ushiriki wa Umma');
    expect((await ussd(PHONE, '1')).text).toContain('weka wadi yako');
  });

  it('ends gracefully on invalid input and closed consultations', async () => {
    const c = await openConsultation();
    expect((await ussd(PHONE, '1')).text).toMatch(/set your ward/i);
    await ussd(PHONE, '4*42*1*1');
    expect((await ussd(PHONE, '9')).text).toMatch(/^END Invalid/);
    expect((await ussd(PHONE, '1*7')).text).toMatch(/^END Invalid/);
    await closeConsultation(c.id);
    expect((await ussd(PHONE, '1')).text).toMatch(/^END There are no open/);
  });
});

describe('inbound SMS', () => {
  beforeEach(resetDb);

  it('turns "<CODE> [stance] comment" into a submission with a receipt', async () => {
    const c = await openConsultation({ code: 'KSMFB26' });
    await inboundSms(E164, 'ksmfb26 hapana   Ada za soko ni kubwa').expect(200);
    const s = await db.submission.findFirstOrThrow({ where: { consultationId: c.id } });
    expect(s).toMatchObject({ channel: 'SMS', stance: 'OPPOSE', body: 'Ada za soko ni kubwa' });
    expect(outbox().at(-1)!.message).toContain(s.reference);

    await inboundSms(E164, `HALI ${s.reference}`);
    expect(outbox().at(-1)!.message).toContain('under review');
  });

  it('replies with help for unknown codes', async () => {
    await inboundSms(E164, 'NOPE something');
    expect(outbox().at(-1)).toMatchObject({ to: E164 });
    expect(outbox().at(-1)!.message).toMatch(/Unknown or closed/);
  });
});
