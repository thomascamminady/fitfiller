import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../app.js';
import { loadConfig } from '../config.js';
import { sampleFit, devFieldFit, multipart, fillRequestFor } from './fixtures.js';

function makeApp(env: Record<string, string> = {}) {
  return buildApp(
    loadConfig({
      AUTH_PROVIDER: 'dev',
      DEV_FORCE_PREMIUM: 'false',
      ELEVATION_PROVIDER: 'none', // keep tests offline
      ...env,
    } as never),
  );
}

async function uploadSample(app: FastifyInstance) {
  const mp = multipart('file', 'run.fit', sampleFit());
  const res = await app.inject({
    method: 'POST',
    url: '/api/activities',
    headers: mp.headers,
    payload: mp.payload,
  });
  return res;
}

describe('API — health & identity', () => {
  let app: FastifyInstance;
  beforeAll(async () => {
    app = await makeApp();
    await app.ready();
  });
  afterAll(() => app.close());

  it('reports health', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe('ok');
  });

  it('exposes the auth context at /me', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/me' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ tier: 'free', isPremium: false });
  });
});

describe('API — upload', () => {
  let app: FastifyInstance;
  beforeAll(async () => {
    app = await makeApp();
    await app.ready();
  });
  afterAll(() => app.close());

  it('parses a FIT upload and returns the activity', async () => {
    const res = await uploadSample(app);
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.id).toBeTruthy();
    expect(body.filename).toBe('run.fit');
    expect(body.activity.pauses).toHaveLength(1);
    expect(body.activity.summary.sport).toBe('running');
  });

  it('rejects a request with no file', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/activities' });
    expect(res.statusCode).toBe(400);
  });

  it('rejects a non-FIT file with 400', async () => {
    const mp = multipart('file', 'bad.fit', Buffer.from('not a fit file at all'));
    const res = await app.inject({
      method: 'POST',
      url: '/api/activities',
      headers: mp.headers,
      payload: mp.payload,
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toMatch(/parse/i);
  });

  it('returns 404 for an unknown activity', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/activities/does-not-exist' });
    expect(res.statusCode).toBe(404);
  });

  it('rejects an oversized upload with 413', async () => {
    const small = await makeApp({ MAX_UPLOAD_BYTES: '100' });
    await small.ready();
    const mp = multipart('file', 'run.fit', sampleFit());
    const res = await small.inject({
      method: 'POST',
      url: '/api/activities',
      headers: mp.headers,
      payload: mp.payload,
    });
    expect(res.statusCode).toBe(413);
    await small.close();
  });

  it('fetches a stored activity by id', async () => {
    const id = (await uploadSample(app)).json().id;
    const res = await app.inject({ method: 'GET', url: `/api/activities/${id}` });
    expect(res.statusCode).toBe(200);
    expect(res.json().id).toBe(id);
  });
});

describe('API — fill & export', () => {
  let app: FastifyInstance;
  beforeAll(async () => {
    app = await makeApp();
    await app.ready();
  });
  afterAll(() => app.close());

  it('previews a fill and returns synthetic records', async () => {
    const upload = (await uploadSample(app)).json();
    const req = fillRequestFor(upload.activity.pauses[0]);
    const res = await app.inject({
      method: 'POST',
      url: `/api/activities/${upload.id}/preview-fill`,
      payload: req,
    });
    expect(res.statusCode).toBe(200);
    const fill = res.json();
    expect(fill.records.length).toBeGreaterThan(0);
    expect(fill.addedDistanceMeters).toBeGreaterThan(0);
  });

  it('rejects an invalid fill request body with 400', async () => {
    const upload = (await uploadSample(app)).json();
    const res = await app.inject({
      method: 'POST',
      url: `/api/activities/${upload.id}/preview-fill`,
      payload: { pauseId: 'pause-0', route: [{ lat: 47, lon: 8 }], config: {} },
    });
    expect(res.statusCode).toBe(400);
  });

  it('returns 404 when the pause id is unknown', async () => {
    const upload = (await uploadSample(app)).json();
    const req = fillRequestFor(upload.activity.pauses[0]);
    req.pauseId = 'pause-99';
    const res = await app.inject({
      method: 'POST',
      url: `/api/activities/${upload.id}/preview-fill`,
      payload: req,
    });
    expect(res.statusCode).toBe(404);
  });

  it('exports a corrected FIT file', async () => {
    const upload = (await uploadSample(app)).json();
    const req = fillRequestFor(upload.activity.pauses[0]);
    const res = await app.inject({
      method: 'POST',
      url: `/api/activities/${upload.id}/export`,
      payload: { fills: [req] },
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('application/octet-stream');
    expect(res.headers['content-disposition']).toContain('run-fit-filler.fit');
    expect(res.rawPayload.length).toBeGreaterThan(100);
  });

  it('returns an export summary that verifies integrity and diffs the files', async () => {
    const upload = (await uploadSample(app)).json();
    const req = fillRequestFor(upload.activity.pauses[0]);
    const res = await app.inject({
      method: 'POST',
      url: `/api/activities/${upload.id}/export-summary`,
      payload: { fills: [req] },
    });
    expect(res.statusCode).toBe(200);
    const s = res.json();
    expect(s.ok).toBe(true);
    expect(s.delta.pausesRemoved).toBe(1);
    expect(s.filled.points).toBeGreaterThan(s.original.points);
    expect(s.delta.distanceMeters).toBeGreaterThan(0);
  });

  it('rejects an export with no fills', async () => {
    const upload = (await uploadSample(app)).json();
    const res = await app.inject({
      method: 'POST',
      url: `/api/activities/${upload.id}/export`,
      payload: { fills: [] },
    });
    expect(res.statusCode).toBe(400);
  });

  it('rejects a fill route with out-of-range coordinates', async () => {
    const upload = (await uploadSample(app)).json();
    const res = await app.inject({
      method: 'POST',
      url: `/api/activities/${upload.id}/preview-fill`,
      payload: {
        pauseId: upload.activity.pauses[0].id,
        route: [{ lat: 999, lon: 8 }, { lat: 47, lon: 8 }],
        config: { actualBreakSeconds: 0 },
      },
    });
    expect(res.statusCode).toBe(400);
  });

  it('exports a file with developer fields without corrupting it', async () => {
    const mp = multipart('file', 'wahoo.fit', devFieldFit());
    const upload = (await app.inject({
      method: 'POST',
      url: '/api/activities',
      headers: mp.headers,
      payload: mp.payload,
    })).json();
    expect(upload.activity.pauses).toHaveLength(1);
    const req = fillRequestFor(upload.activity.pauses[0]);
    const res = await app.inject({
      method: 'POST',
      url: `/api/activities/${upload.id}/export-summary`,
      payload: { fills: [req] },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().ok).toBe(true);
  });
});

describe('API — premium gating', () => {
  it('blocks grade-adjust for free users (402)', async () => {
    const app = await makeApp({ DEV_FORCE_PREMIUM: 'false' });
    await app.ready();
    const upload = (await uploadSample(app)).json();
    const req = fillRequestFor(upload.activity.pauses[0]);
    const res = await app.inject({
      method: 'POST',
      url: `/api/activities/${upload.id}/preview-fill`,
      payload: { ...req, config: { ...req.config, gradeAdjust: true } },
    });
    expect(res.statusCode).toBe(402);
    expect(res.json().code).toBe('premium_required');
    await app.close();
  });

  it('blocks premium features on export-summary too (402)', async () => {
    const app = await makeApp({ DEV_FORCE_PREMIUM: 'false' });
    await app.ready();
    const upload = (await uploadSample(app)).json();
    const req = fillRequestFor(upload.activity.pauses[0]);
    const res = await app.inject({
      method: 'POST',
      url: `/api/activities/${upload.id}/export-summary`,
      payload: { fills: [{ ...req, config: { ...req.config, gradeAdjust: true } }] },
    });
    expect(res.statusCode).toBe(402);
    await app.close();
  });

  it('blocks route-elevation for free users (402)', async () => {
    const app = await makeApp({ DEV_FORCE_PREMIUM: 'false' });
    await app.ready();
    const upload = (await uploadSample(app)).json();
    const req = fillRequestFor(upload.activity.pauses[0]);
    const res = await app.inject({
      method: 'POST',
      url: `/api/activities/${upload.id}/preview-fill`,
      payload: { ...req, config: { ...req.config, elevation: { mode: 'route' } } },
    });
    expect(res.statusCode).toBe(402);
    await app.close();
  });

  it('unlocks premium after subscribing, then re-locks on cancel', async () => {
    const app = await makeApp({ DEV_FORCE_PREMIUM: 'false' });
    await app.ready();
    expect((await app.inject({ method: 'GET', url: '/api/me' })).json().isPremium).toBe(false);

    const sub = await app.inject({ method: 'POST', url: '/api/billing/subscribe' });
    expect(sub.statusCode).toBe(200);
    expect(sub.json().isPremium).toBe(true);
    expect((await app.inject({ method: 'GET', url: '/api/me' })).json().isPremium).toBe(true);

    await app.inject({ method: 'POST', url: '/api/billing/cancel' });
    expect((await app.inject({ method: 'GET', url: '/api/me' })).json().isPremium).toBe(false);
    await app.close();
  });

  it('allows premium features when DEV_FORCE_PREMIUM is on', async () => {
    const app = await makeApp({ DEV_FORCE_PREMIUM: 'true' });
    await app.ready();
    const meRes = await app.inject({ method: 'GET', url: '/api/me' });
    expect(meRes.json().isPremium).toBe(true);

    const upload = (await uploadSample(app)).json();
    const req = fillRequestFor(upload.activity.pauses[0]);
    const res = await app.inject({
      method: 'POST',
      url: `/api/activities/${upload.id}/preview-fill`,
      // gradeAdjust without an elevation provider just behaves as constant pace.
      payload: { ...req, config: { ...req.config, gradeAdjust: true } },
    });
    expect(res.statusCode).toBe(200);
    await app.close();
  });
});
