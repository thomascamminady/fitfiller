import type { GeoPoint } from '../domain/types.js';

const EARTH_RADIUS_M = 6_371_008.8;

const toRad = (deg: number): number => (deg * Math.PI) / 180;

/** Great-circle distance between two coordinates in metres (haversine). */
export function haversineMeters(a: GeoPoint, b: GeoPoint): number {
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Total length of a polyline in metres. */
export function polylineLengthMeters(points: readonly GeoPoint[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += haversineMeters(points[i - 1]!, points[i]!);
  }
  return total;
}

/**
 * Returns the cumulative distance (metres) from the start of the polyline to
 * each vertex. The first entry is always 0; the last entry is the total length.
 */
export function cumulativeDistances(points: readonly GeoPoint[]): number[] {
  const out: number[] = new Array(points.length).fill(0);
  for (let i = 1; i < points.length; i++) {
    out[i] = out[i - 1]! + haversineMeters(points[i - 1]!, points[i]!);
  }
  return out;
}

/**
 * Linearly interpolate between two coordinates. `t` in `[0, 1]`.
 *
 * For the short distances involved in filling a gap, linear interpolation in
 * lat/lon space is more than accurate enough.
 */
export function lerpPoint(a: GeoPoint, b: GeoPoint, t: number): GeoPoint {
  return {
    lat: a.lat + (b.lat - a.lat) * t,
    lon: a.lon + (b.lon - a.lon) * t,
  };
}

/**
 * Find the point that lies `targetMeters` along a polyline, plus the polyline
 * fraction (`0..1`) it sits at. Useful for sampling a drawn route at a constant
 * speed.
 */
export function pointAtDistance(
  points: readonly GeoPoint[],
  cum: readonly number[],
  targetMeters: number,
): GeoPoint {
  if (points.length === 0) throw new Error('pointAtDistance: empty polyline');
  if (points.length === 1) return points[0]!;
  const total = cum[cum.length - 1]!;
  const clamped = Math.max(0, Math.min(total, targetMeters));
  // Find the segment containing the target distance.
  let i = 1;
  while (i < cum.length && cum[i]! < clamped) i++;
  const segStart = cum[i - 1]!;
  const segEnd = cum[i]!;
  const segLen = segEnd - segStart;
  const t = segLen <= 0 ? 0 : (clamped - segStart) / segLen;
  return lerpPoint(points[i - 1]!, points[i]!, t);
}
