// Fully client-side engine. fitfiller runs entirely in the browser — the FIT
// file never leaves the device. Pauses, gap fills and re-encoding are computed
// here with @fitfiller/core; optional path-snapping and real elevation call
// free, key-less, CORS-friendly public services (and fall back gracefully).
import {
  decodeFit,
  encodeFit,
  buildGapFill,
  BRouterRoutingProvider,
  type DecodedFit,
  type GeoPoint,
  type GapFillInput,
} from '@fitfiller/core';
import type {
  ActivityStats,
  ExportSummary,
  FillRequest,
  GapFill,
  ParsedActivity,
  UploadResponse,
} from './types';

/** Kept for compatibility with existing error handling in the UI. */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface Entry {
  filename: string;
  decoded: DecodedFit;
}

const store = new Map<string, Entry>();
// Defer to the live global fetch (so it stays mockable and reflects runtime).
const router = new BRouterRoutingProvider({
  fetchImpl: ((input, init) => fetch(input, init)) as typeof fetch,
});

function get(id: string): Entry {
  const entry = store.get(id);
  if (!entry) throw new ApiError(404, 'Activity not found');
  return entry;
}

/** Real elevation via Open-Meteo (free, key-less, CORS-enabled). */
async function lookupElevations(
  points: readonly GeoPoint[],
): Promise<(number | null)[]> {
  const out: (number | null)[] = [];
  for (let i = 0; i < points.length; i += 100) {
    const batch = points.slice(i, i + 100);
    const latitude = batch.map((p) => p.lat).join(',');
    const longitude = batch.map((p) => p.lon).join(',');
    try {
      const res = await fetch(
        `https://api.open-meteo.com/v1/elevation?latitude=${latitude}&longitude=${longitude}`,
      );
      if (!res.ok) {
        batch.forEach(() => out.push(null));
        continue;
      }
      const body = (await res.json()) as { elevation?: number[] };
      batch.forEach((_, j) => {
        const e = body.elevation?.[j];
        out.push(typeof e === 'number' && Number.isFinite(e) ? e : null);
      });
    } catch {
      batch.forEach(() => out.push(null));
    }
  }
  return out;
}

async function buildOne(
  decoded: DecodedFit,
  req: FillRequest,
): Promise<GapFill> {
  const pause = decoded.activity.pauses.find((p) => p.id === req.pauseId);
  if (!pause) throw new ApiError(404, `Pause not found: ${req.pauseId}`);

  // Snap the drawn route to real paths when asked; fall back to the straight
  // route if routing is unavailable.
  let route: GeoPoint[] = req.route;
  if (req.config.snapToPath) {
    const snapped = await router.snap(req.route);
    if (snapped && snapped.length >= 2) route = snapped;
  }

  const input: GapFillInput = { pause, route, config: req.config };
  if (req.config.elevation?.mode === 'route' || req.config.gradeAdjust) {
    input.routeElevations = await lookupElevations(route);
  }
  return buildGapFill(input) as unknown as GapFill;
}

function summarize(activity: ParsedActivity): ActivityStats {
  const points = activity.points;
  const first = points[0];
  const last = points[points.length - 1];
  const distance =
    activity.summary.totalDistanceMeters ?? last?.distance ?? null;
  const elapsed =
    first && last ? Math.round((last.time - first.time) / 1000) : null;
  const duration = activity.summary.totalTimerSeconds ?? elapsed;
  return {
    points: points.length,
    distanceMeters: distance,
    durationSeconds: duration,
    pauses: activity.pauses.length,
    filledHeartRatePoints: points.filter((p) => p.heartRate !== null).length,
  };
}

export const api = {
  async upload(file: File): Promise<UploadResponse> {
    const bytes = new Uint8Array(await file.arrayBuffer());
    let decoded: DecodedFit;
    try {
      decoded = decodeFit(bytes);
    } catch (err) {
      throw new ApiError(
        400,
        `Could not parse FIT file: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    const id = crypto.randomUUID();
    store.set(id, { filename: file.name, decoded });
    return {
      id,
      filename: file.name,
      activity: decoded.activity as unknown as ParsedActivity,
    };
  },

  async previewFill(id: string, req: FillRequest): Promise<GapFill> {
    return buildOne(get(id).decoded, req);
  },

  async exportSummary(
    id: string,
    fills: FillRequest[],
  ): Promise<ExportSummary> {
    const { decoded } = get(id);
    const built = await Promise.all(fills.map((f) => buildOne(decoded, f)));
    const bytes = encodeFit(
      decoded.raw,
      built as never,
      decoded.fieldDescriptions,
    );

    const original = summarize(decoded.activity as unknown as ParsedActivity);
    let ok = true;
    let filled = original;
    try {
      filled = summarize(
        decodeFit(bytes).activity as unknown as ParsedActivity,
      );
    } catch {
      ok = false;
    }

    return {
      ok,
      original,
      filled,
      delta: {
        points: filled.points - original.points,
        distanceMeters:
          (filled.distanceMeters ?? 0) - (original.distanceMeters ?? 0),
        durationSeconds:
          (filled.durationSeconds ?? 0) - (original.durationSeconds ?? 0),
        pausesRemoved: original.pauses - filled.pauses,
      },
    };
  },

  async export(id: string, fills: FillRequest[]): Promise<Blob> {
    const { decoded } = get(id);
    const built = await Promise.all(fills.map((f) => buildOne(decoded, f)));
    const bytes = encodeFit(
      decoded.raw,
      built as never,
      decoded.fieldDescriptions,
    );
    return new Blob([bytes as BlobPart], {
      type: 'application/octet-stream',
    });
  },
};
