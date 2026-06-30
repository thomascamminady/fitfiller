import type { GeoPoint } from '../domain/types.js';

/**
 * Pluggable route snapping. Given the coarse points the athlete drew across a
 * gap, return a denser polyline that follows the real path network between
 * them. Implementations should keep the endpoints anchored to the inputs and
 * return `null` when routing is unavailable, so callers fall back to the
 * straight drawn route.
 */
export interface RoutingProvider {
  readonly name: string;
  snap(points: readonly GeoPoint[]): Promise<GeoPoint[] | null>;
}

/** No-op provider: never snaps (used when routing is disabled or in tests). */
export class NullRoutingProvider implements RoutingProvider {
  readonly name = 'none';
  async snap(): Promise<GeoPoint[] | null> {
    return null;
  }
}

export interface BRouterRoutingProviderOptions {
  /** BRouter base URL. Defaults to the public server at brouter.de. */
  url?: string;
  /** Routing profile. Foot/trail-oriented profiles suit running. */
  profile?: string;
  fetchImpl?: typeof fetch;
}

/**
 * Snaps via a BRouter server (brouter.de) — free, key-less and trail-aware,
 * which fits running/hiking better than car-only routers. Returns the routed
 * geometry, or `null` when given fewer than two points or the request fails.
 */
export class BRouterRoutingProvider implements RoutingProvider {
  readonly name = 'brouter';
  private readonly url: string;
  private readonly profile: string;
  private readonly fetchImpl: typeof fetch;

  constructor(opts: BRouterRoutingProviderOptions = {}) {
    this.url = opts.url ?? 'https://brouter.de/brouter';
    this.profile = opts.profile ?? 'trekking';
    this.fetchImpl = opts.fetchImpl ?? fetch;
  }

  async snap(points: readonly GeoPoint[]): Promise<GeoPoint[] | null> {
    if (points.length < 2) return null;
    const lonlats = points.map((p) => `${p.lon},${p.lat}`).join('|');
    const url = new URL(this.url);
    url.searchParams.set('lonlats', lonlats);
    url.searchParams.set('profile', this.profile);
    url.searchParams.set('alternativeidx', '0');
    url.searchParams.set('format', 'geojson');

    let res: Response;
    try {
      res = await this.fetchImpl(url.toString());
    } catch {
      return null;
    }
    if (!res.ok) return null;

    const body = (await res.json()) as {
      features?: { geometry?: { coordinates?: number[][] } }[];
    };
    const coords = body.features?.[0]?.geometry?.coordinates;
    if (!coords || coords.length < 2) return null;
    // BRouter returns [lon, lat, ele?]; keep lon/lat.
    return coords
      .filter((c) => c.length >= 2)
      .map((c) => ({ lat: c[1]!, lon: c[0]! }));
  }
}
