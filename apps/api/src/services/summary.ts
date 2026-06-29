import type { ParsedActivity } from '@fitfiller/core';

export interface ActivityStats {
  points: number;
  distanceMeters: number | null;
  durationSeconds: number | null;
  pauses: number;
  filledHeartRatePoints: number;
}

/** Condense a parsed activity into the numbers the export summary compares. */
export function summarize(activity: ParsedActivity): ActivityStats {
  const points = activity.points;
  const first = points[0];
  const last = points[points.length - 1];
  const distance =
    activity.summary.totalDistanceMeters ?? last?.distance ?? null;
  // Prefer moving/timer time (which grows when a gap is filled) over elapsed
  // wall-clock time (which doesn't, since the pause already consumed it).
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

export interface ExportSummary {
  /** True when the re-encoded file decodes cleanly (i.e. not corrupted). */
  ok: boolean;
  original: ActivityStats;
  filled: ActivityStats;
  /** Convenience deltas for the UI. */
  delta: {
    points: number;
    distanceMeters: number;
    durationSeconds: number;
    pausesRemoved: number;
  };
}
