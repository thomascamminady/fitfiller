import { describe, it, expect, vi } from 'vitest';
import {
  NullElevationProvider,
  HttpElevationProvider,
} from '../elevation/provider.js';
import type { GeoPoint } from '../domain/types.js';

const pts: GeoPoint[] = [
  { lat: 47, lon: 8 },
  { lat: 47.1, lon: 8.1 },
  { lat: 47.2, lon: 8.2 },
];

function jsonResponse(body: unknown, ok = true): Response {
  return {
    ok,
    status: ok ? 200 : 500,
    json: async () => body,
  } as Response;
}

describe('NullElevationProvider', () => {
  it('returns null for every point', async () => {
    const out = await new NullElevationProvider().lookup(pts);
    expect(out).toEqual([null, null, null]);
  });
});

describe('HttpElevationProvider', () => {
  it('resolves elevations and preserves order', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({
        results: [{ elevation: 500 }, { elevation: 520 }, { elevation: 540 }],
      }),
    );
    const provider = new HttpElevationProvider({
      name: 'test',
      url: 'https://example.com/lookup',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(await provider.lookup(pts)).toEqual([500, 520, 540]);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('batches requests by batchSize', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse({ results: [{ elevation: 1 }] }));
    const provider = new HttpElevationProvider({
      name: 'test',
      url: 'https://example.com/lookup',
      batchSize: 1,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    await provider.lookup(pts);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it('includes the locations and api key in the query', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse({ results: [{ elevation: 1 }] }));
    const provider = new HttpElevationProvider({
      name: 'test',
      url: 'https://example.com/lookup',
      apiKey: 'secret',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    await provider.lookup([{ lat: 1, lon: 2 }]);
    const url = new URL(fetchImpl.mock.calls[0]![0] as string);
    expect(url.searchParams.get('locations')).toBe('1,2');
    expect(url.searchParams.get('key')).toBe('secret');
  });

  it('returns null for a failed request without throwing', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({}, false));
    const provider = new HttpElevationProvider({
      name: 'test',
      url: 'https://example.com/lookup',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(await provider.lookup(pts)).toEqual([null, null, null]);
  });

  it('treats invalid elevation values as null', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({ results: [{ elevation: null }, { elevation: 'nope' }, {}] }),
    );
    const provider = new HttpElevationProvider({
      name: 'test',
      url: 'https://example.com/lookup',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(await provider.lookup(pts)).toEqual([null, null, null]);
  });
});
