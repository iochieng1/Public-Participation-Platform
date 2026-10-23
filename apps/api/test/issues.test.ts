import { beforeEach, describe, expect, it } from 'vitest';
import { app, auth, kisumuWard, makeUser, outbox, request, resetDb } from './helpers.js';

describe('ward issues', () => {
  beforeEach(resetDb);

  it('lets citizens report and upvote once; only the county officer can respond', async () => {
    const ward = await kisumuWard('Kondele');
    const reporter = await makeUser('CITIZEN', { wardId: ward.id });
    const neighbour = await makeUser();

    const issue = (
      await request(app)
        .post('/api/issues')
        .set(auth(reporter.token))
        .send({ wardId: ward.id, category: 'WATER', title: 'No water in Kondele', description: 'Taps dry for two weeks.' })
        .expect(201)
    ).body;
    expect(issue.reference).toMatch(/^I-/);

    await request(app).post(`/api/issues/${issue.id}/upvote`).set(auth(neighbour.token)).expect(200);
    const again = await request(app).post(`/api/issues/${issue.id}/upvote`).set(auth(neighbour.token)).expect(200);
    expect(again.body.upvoteCount).toBe(1);

    const list = await request(app).get('/api/issues?countyId=42').expect(200);
    expect(list.body).toHaveLength(1);
    expect(list.body[0].reporterId).toBeUndefined();

    const nairobi = await makeUser('OFFICER', { countyId: 47 });
    await request(app)
      .post(`/api/issues/${issue.id}/updates`)
      .set(auth(nairobi.token))
      .send({ status: 'ACKNOWLEDGED', note: 'Noted' })
      .expect(403);

    const kisumu = await makeUser('OFFICER', { countyId: 42 });
    await request(app)
      .post(`/api/issues/${issue.id}/updates`)
      .set(auth(kisumu.token))
      .send({ status: 'IN_PROGRESS', note: 'KIWASCO crew dispatched.' })
      .expect(201);
    expect(outbox().at(-1)).toMatchObject({ to: reporter.user.phone });
    expect(outbox().at(-1)!.message).toContain('KIWASCO crew dispatched.');

    const detail = await request(app).get(`/api/issues/${issue.id}`).expect(200);
    expect(detail.body.status).toBe('IN_PROGRESS');
    expect(detail.body.updates).toHaveLength(1);
  });
});
