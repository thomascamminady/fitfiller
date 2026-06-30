import type { GeoPoint, PauseSegment, TrackPoint } from '../domain/types.js';
import {
  cumulativeDistances,
  haversineMeters,
  lerpPoint,
} from '../geo/distance.js';

export type FillMode = 'none' | 'average' | 'value';

export interface GapFillConfig {
  /** Seconds of the pause the athlete was genuinely standing still. */
  actualBreakSeconds: number;
  /** Spacing of synthetic records in seconds. Default 1. */
  sampleSeconds?: number;
  /** How to populate heart rate across the gap. */
  heartRate?: { mode: FillMode; value?: number };
  /** How to populate cadence across the gap. */
  cadence?: { mode: FillMode; value?: number };
  /**
   * Elevation strategy:
   *  - `linear`: straight line between the endpoints' altitudes.
   *  - `route`: sample {@link GapFillInput.routeElevations} along the route
   *    (premium; falls back to linear where data is missing).
   */
  elevation?: { mode: 'linear' | 'route' };
  /**
   * Premium: vary speed by terrain grade (constant *effort* rather than
   * constant pace) using Minetti's cost-of-running model. Requires elevation
   * data along the route; otherwise behaves as constant pace.
   */
  gradeAdjust?: boolean;
  /**
   * Snap the drawn route to the path network before filling. Handled upstream
   * (a {@link RoutingProvider} replaces the route); ignored by `buildGapFill`.
   */
  snapToPath?: boolean;
}

export interface GapFillInput {
  pause: PauseSegment;
  /** The route actually travelled, ordered from `before` to `after`. */
  route: GeoPoint[];
  config: GapFillConfig;
  /** Optional elevation (m) per route vertex; aligned to {@link route}. */
  routeElevations?: (number | null)[];
}

export interface GapFill {
  pauseId: string;
  /** Synthetic records to splice into the activity, ascending by time. */
  records: TrackPoint[];
  /** Distance the gap adds to the activity, metres. */
  addedDistanceMeters: number;
  /** Inserted moving time, seconds. */
  movingSeconds: number;
  /** Epoch ms when the timer originally stopped (start of the gap). */
  stopTime: number;
  /** Epoch ms when the timer originally resumed (end of the gap). */
  startTime: number;
  /** Drop the bracketing timer stop/start events when re-encoding. */
  dropTimerEvents: boolean;
}

/** Minetti et al. energy cost of running (J/kg/m) as a function of gradient. */
function runningCost(gradient: number): number {
  const i = Math.max(-0.45, Math.min(0.45, gradient));
  return (
    155.4 * i ** 5 -
    30.4 * i ** 4 -
    43.3 * i ** 3 +
    46.3 * i ** 2 +
    19.5 * i +
    3.6
  );
}
const FLAT_COST = runningCost(0);

function resolveFill(
  mode: FillMode | undefined,
  value: number | undefined,
  a: number | null,
  b: number | null,
): number | null {
  switch (mode) {
    case 'value':
      return value ?? null;
    case 'average': {
      const vals = [a, b].filter((v): v is number => v !== null);
      if (vals.length === 0) return null;
      return Math.round(vals.reduce((s, v) => s + v, 0) / vals.length);
    }
    default:
      return null;
  }
}

function elevationAtDistance(
  cum: number[],
  elevations: (number | null)[],
  dist: number,
): number | null {
  if (cum.length === 0) return null;
  let i = 1;
  while (i < cum.length && cum[i]! < dist) i++;
  const e0 = elevations[i - 1] ?? null;
  const e1 = elevations[i] ?? null;
  if (e0 === null) return e1;
  if (e1 === null) return e0;
  const segLen = cum[i]! - cum[i - 1]!;
  const t = segLen <= 0 ? 0 : (dist - cum[i - 1]!) / segLen;
  return e0 + (e1 - e0) * t;
}

/**
 * Build the synthetic records that fill a single paused gap.
 *
 * The athlete is assumed to stand still for `actualBreakSeconds`, then move
 * along `route` for the remaining pause time. Speed is constant by default, or
 * grade-adjusted (constant effort) when `gradeAdjust` is set and elevation data
 * is available. Heart rate, cadence and elevation are filled per config.
 */
export function buildGapFill(input: GapFillInput): GapFill {
  const { pause, route, config } = input;
  if (route.length < 2) {
    throw new Error('A gap route needs at least two points');
  }

  const cum = cumulativeDistances(route);
  const totalDistance = cum[cum.length - 1]!;
  const sampleSeconds = config.sampleSeconds ?? 1;

  const actualBreak = Math.max(
    0,
    Math.min(config.actualBreakSeconds, pause.pausedSeconds),
  );
  const movingSeconds = Math.max(1, pause.pausedSeconds - actualBreak);

  // Per-segment time weights: 1 for constant pace, grade cost otherwise.
  const useElevation = !!input.routeElevations;
  const weights: number[] = [];
  let totalWeight = 0;
  for (let k = 1; k < route.length; k++) {
    const len = cum[k]! - cum[k - 1]!;
    let cost = 1;
    if (config.gradeAdjust && useElevation) {
      const e0 = input.routeElevations![k - 1] ?? null;
      const e1 = input.routeElevations![k] ?? null;
      if (e0 !== null && e1 !== null && len > 0) {
        cost = runningCost((e1 - e0) / len) / FLAT_COST;
      }
    }
    const w = len * cost;
    weights.push(w);
    totalWeight += w;
  }
  if (totalWeight <= 0) totalWeight = 1;

  // Cumulative *time* (seconds from move start) at each route vertex.
  const vertexTime: number[] = new Array(route.length).fill(0);
  for (let k = 1; k < route.length; k++) {
    vertexTime[k] =
      vertexTime[k - 1]! + (weights[k - 1]! / totalWeight) * movingSeconds;
  }

  const records: TrackPoint[] = [];

  const heartRate = resolveFill(
    config.heartRate?.mode,
    config.heartRate?.value,
    pause.before.heartRate,
    pause.after.heartRate,
  );
  const cadence = resolveFill(
    config.cadence?.mode,
    config.cadence?.value,
    pause.before.cadence,
    pause.after.cadence,
  );

  // Only carry a cumulative distance if the source data actually had one;
  // otherwise leave it null rather than fabricating a 0 baseline.
  const beforeDistance = pause.before.distance;
  const beforeAlt = pause.before.altitude;
  const afterAlt = pause.after.altitude;

  // We fill the *entire* pause window so the re-encoded activity has no gap:
  //  - during the break the athlete stands still at the `before` position;
  //  - afterwards they move along the route, sampled by the time->vertex
  //    schedule so grade-adjusted speed falls out naturally.
  for (let s = sampleSeconds; s < pause.pausedSeconds; s += sampleSeconds) {
    const time = Math.round(pause.stopTime + s * 1000);

    if (s <= actualBreak) {
      records.push({
        time,
        lat: pause.before.lat,
        lon: pause.before.lon,
        altitude: beforeAlt,
        distance: beforeDistance,
        speed: 0,
        heartRate,
        cadence,
      });
      continue;
    }

    const moveS = s - actualBreak; // seconds into the movement phase
    // Locate the route segment whose time window contains `moveS`.
    let k = 1;
    while (k < vertexTime.length && vertexTime[k]! < moveS) k++;
    if (k >= vertexTime.length) k = vertexTime.length - 1;
    const t0 = vertexTime[k - 1]!;
    const t1 = vertexTime[k]!;
    const segFrac = t1 <= t0 ? 0 : (moveS - t0) / (t1 - t0);
    const pos = lerpPoint(route[k - 1]!, route[k]!, segFrac);
    const distAlong = cum[k - 1]! + (cum[k]! - cum[k - 1]!) * segFrac;
    const distanceFraction = totalDistance > 0 ? distAlong / totalDistance : 0;

    const segLen = cum[k]! - cum[k - 1]!;
    const segTime = t1 - t0;
    const speed =
      segTime > 0 ? segLen / segTime : totalDistance / movingSeconds;

    let altitude: number | null;
    if (config.elevation?.mode === 'route' && useElevation) {
      altitude = elevationAtDistance(cum, input.routeElevations!, distAlong);
    } else if (beforeAlt !== null && afterAlt !== null) {
      altitude = beforeAlt + (afterAlt - beforeAlt) * distanceFraction;
    } else {
      altitude = beforeAlt ?? afterAlt;
    }

    records.push({
      time,
      lat: pos.lat,
      lon: pos.lon,
      altitude,
      distance: beforeDistance === null ? null : beforeDistance + distAlong,
      speed,
      heartRate,
      cadence,
    });
  }

  return {
    pauseId: pause.id,
    records,
    addedDistanceMeters: totalDistance,
    movingSeconds,
    stopTime: pause.stopTime,
    startTime: pause.startTime,
    dropTimerEvents: true,
  };
}

/** Straight-line fallback route when the user hasn't drawn one. */
export function straightRoute(pause: PauseSegment): GeoPoint[] {
  const { before, after } = pause;
  if (
    before.lat === null ||
    before.lon === null ||
    after.lat === null ||
    after.lon === null
  ) {
    throw new Error('Pause endpoints lack GPS positions for a straight route');
  }
  return [
    { lat: before.lat, lon: before.lon },
    { lat: after.lat, lon: after.lon },
  ];
}

/** Convenience: straight-line distance of a route in metres. */
export function routeDistanceMeters(route: readonly GeoPoint[]): number {
  let d = 0;
  for (let i = 1; i < route.length; i++)
    d += haversineMeters(route[i - 1]!, route[i]!);
  return d;
}
