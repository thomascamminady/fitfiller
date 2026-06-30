import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { api, ApiError } from './api';

function ok(body: unknown): Response {
  return { ok: true, status: 200, json: async () => body } as Response;
}
function fail(status: number, body: unknown): Response {
  return {
    ok: false,
    status,
    statusText: 'err',
    json: async () => body,
  } as Response;
}

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
});
afterEach(() => vi.unstubAllGlobals());

describe('api client', () => {
  it('me() returns the auth context', async () => {
    fetchMock.mockResolvedValue(
      ok({ userId: 'u', isPremium: false, tier: 'free' }),
    );
    expect(await api.me()).toMatchObject({ tier: 'free' });
    expect(fetchMock).toHaveBeenCalledWith('/api/me');
  });

  it('upload() posts multipart form data', async () => {
    fetchMock.mockResolvedValue(
      ok({ id: 'a1', filename: 'r.fit', activity: {} }),
    );
    const file = new File([new Uint8Array([1, 2, 3])], 'r.fit');
    const res = await api.upload(file);
    expect(res.id).toBe('a1');
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('/api/activities');
    expect((init as RequestInit).method).toBe('POST');
    expect((init as RequestInit).body).toBeInstanceOf(FormData);
  });

  it('previewFill() posts JSON to the right url', async () => {
    fetchMock.mockResolvedValue(ok({ pauseId: 'pause-0', records: [] }));
    await api.previewFill('a1', {
      pauseId: 'pause-0',
      route: [],
      config: { actualBreakSeconds: 0 },
    });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('/api/activities/a1/preview-fill');
    expect((init as RequestInit).headers).toMatchObject({
      'Content-Type': 'application/json',
    });
  });

  it('exportSummary() posts fills and returns the diff', async () => {
    fetchMock.mockResolvedValue(ok({ ok: true, delta: { pausesRemoved: 1 } }));
    const out = await api.exportSummary('a1', []);
    expect(out.ok).toBe(true);
    expect(fetchMock.mock.calls[0]![0]).toBe(
      '/api/activities/a1/export-summary',
    );
  });

  it('subscribe() posts to the billing endpoint', async () => {
    fetchMock.mockResolvedValue(
      ok({ isPremium: true, tier: 'premium', userId: 'u' }),
    );
    const out = await api.subscribe();
    expect(out.isPremium).toBe(true);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('/api/billing/subscribe');
    expect((init as RequestInit).method).toBe('POST');
  });

  it('export() returns a Blob', async () => {
    const blob = new Blob([new Uint8Array([1])]);
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      blob: async () => blob,
    } as Response);
    const out = await api.export('a1', []);
    expect(out).toBeInstanceOf(Blob);
  });

  it('throws ApiError with code on a non-2xx response', async () => {
    fetchMock.mockResolvedValue(
      fail(402, { error: 'Premium required', code: 'premium_required' }),
    );
    await expect(
      api.previewFill('a1', {
        pauseId: 'p',
        route: [],
        config: { actualBreakSeconds: 0 },
      }),
    ).rejects.toMatchObject({ status: 402, code: 'premium_required' });
  });

  it('export() surfaces ApiError on failure', async () => {
    fetchMock.mockResolvedValue(fail(400, { error: 'bad' }));
    await expect(api.export('a1', [])).rejects.toBeInstanceOf(ApiError);
  });
});
