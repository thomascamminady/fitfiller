import type { GeoPoint } from '../domain/types.js';

/**
 * Pluggable elevation lookup. Premium tiers can wire in a real DEM-backed
 * provider; the default returns no data so callers fall back to linear
 * interpolation between the endpoints of a gap.
 */
export interface ElevationProvider {
  readonly name: string;
  /**
   * Resolve elevation (metres) for each input coordinate. Implementations
   * should return `null` for points they cannot resolve and preserve order.
   */
  lookup(points: readonly GeoPoint[]): Promise<(number | null)[]>;
}

/** No-op provider used when elevation enrichment is unavailable/disabled. */
export class NullElevationProvider implements ElevationProvider {
  readonly name = 'none';
  async lookup(points: readonly GeoPoint[]): Promise<(number | null)[]> {
    return points.map(() => null);
  }
}

export interface HttpElevationProviderOptions {
  name: string;
  /** Endpoint that accepts `locations=lat,lon|lat,lon` and returns results. */
  url: string;
  apiKey?: string;
  /** Max coordinates per request (providers cap batch size). Default 100. */
  batchSize?: number;
  fetchImpl?: typeof fetch;
}

/**
 * Generic provider for OpenTopoData / Open-Elevation style HTTP APIs, both of
 * which accept `locations=lat,lon|...` and return `{ results: [{ elevation }] }`.
 */
export class HttpElevationProvider implements ElevationProvider {
  readonly name: string;
  private readonly url: string;
  private readonly apiKey?: string;
  private readonly batchSize: number;
  private readonly fetchImpl: typeof fetch;

  constructor(opts: HttpElevationProviderOptions) {
    this.name = opts.name;
    this.url = opts.url;
    this.apiKey = opts.apiKey;
    this.batchSize = opts.batchSize ?? 100;
    this.fetchImpl = opts.fetchImpl ?? fetch;
  }

  async lookup(points: readonly GeoPoint[]): Promise<(number | null)[]> {
    const out: (number | null)[] = [];
    for (let i = 0; i < points.length; i += this.batchSize) {
      const batch = points.slice(i, i + this.batchSize);
      const locations = batch.map((p) => `${p.lat},${p.lon}`).join('|');
      const url = new URL(this.url);
      url.searchParams.set('locations', locations);
      if (this.apiKey) url.searchParams.set('key', this.apiKey);
      const res = await this.fetchImpl(url.toString());
      if (!res.ok) {
        for (let j = 0; j < batch.length; j++) out.push(null);
        continue;
      }
      const body = (await res.json()) as {
        results?: { elevation?: number | null }[];
      };
      for (let j = 0; j < batch.length; j++) {
        const e = body.results?.[j]?.elevation;
        out.push(typeof e === 'number' && Number.isFinite(e) ? e : null);
      }
    }
    return out;
  }
}
