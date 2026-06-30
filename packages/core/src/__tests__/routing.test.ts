import { describe, it, expect, vi } from 'vitest';
import {
  BRouterRoutingProvider,
  NullRoutingProvider,
} from '../routing/provider.js';

function geojsonResponse(coords: number[][]) {
  return {
    ok: true,
    json: async () => ({
      type: 'FeatureCollection',
      features: [{ geometry: { type: 'LineString', coordinates: coords } }],
    }),
  } as unknown as Response;
}

const A = { lat: 47, lon: 8 };
const B = { lat: 47.002, lon: 8.002 };

describe('routing providers', () => {
  it('NullRoutingProvider never snaps', async () => {
    expect(await new NullRoutingProvider().snap([A, B])).toBeNull();
  });

  it('BRouter parses the routed [lon,lat,ele] geometry into lat/lon', async () => {
    const fetchImpl = vi.fn(async () =>
      geojsonResponse([
        [8, 47, 300],
        [8.001, 47.001, 301],
        [8.002, 47.002, 302],
      ]),
    ) as unknown as typeof fetch;

    const out = await new BRouterRoutingProvider({ fetchImpl }).snap([A, B]);
    expect(out).toEqual([
      { lat: 47, lon: 8 },
      { lat: 47.001, lon: 8.001 },
      { lat: 47.002, lon: 8.002 },
    ]);

    const url = new URL(
      (fetchImpl as unknown as { mock: { calls: string[][] } }).mock
        .calls[0]![0]!,
    );
    expect(url.searchParams.get('lonlats')).toBe('8,47|8.002,47.002');
    expect(url.searchParams.get('format')).toBe('geojson');
    expect(url.searchParams.get('profile')).toBe('trekking');
  });

  it('returns null on an HTTP error or a network failure', async () => {
    const bad = new BRouterRoutingProvider({
      fetchImpl: (async () => ({ ok: false }) as Response) as typeof fetch,
    });
    expect(await bad.snap([A, B])).toBeNull();

    const broken = new BRouterRoutingProvider({
      fetchImpl: (async () => {
        throw new Error('network');
      }) as typeof fetch,
    });
    expect(await broken.snap([A, B])).toBeNull();
  });

  it('needs at least two points', async () => {
    const p = new BRouterRoutingProvider({
      fetchImpl: vi.fn() as typeof fetch,
    });
    expect(await p.snap([A])).toBeNull();
  });
});
