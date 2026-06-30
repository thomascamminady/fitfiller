import { describe, it, expect } from 'vitest';
import {
  haversineMeters,
  polylineLengthMeters,
  cumulativeDistances,
  lerpPoint,
  pointAtDistance,
} from '../geo/distance.js';

describe('haversineMeters', () => {
  it('is zero for identical points', () => {
    expect(haversineMeters({ lat: 47, lon: 8 }, { lat: 47, lon: 8 })).toBe(0);
  });

  it('matches a known distance (1° latitude ≈ 111 km)', () => {
    const d = haversineMeters({ lat: 0, lon: 0 }, { lat: 1, lon: 0 });
    expect(d).toBeGreaterThan(111_000);
    expect(d).toBeLessThan(111_400);
  });

  it('is symmetric', () => {
    const a = { lat: 47.1, lon: 8.2 };
    const b = { lat: 47.3, lon: 8.5 };
    expect(haversineMeters(a, b)).toBeCloseTo(haversineMeters(b, a), 6);
  });
});

describe('polylineLengthMeters', () => {
  it('is zero for fewer than two points', () => {
    expect(polylineLengthMeters([])).toBe(0);
    expect(polylineLengthMeters([{ lat: 1, lon: 1 }])).toBe(0);
  });

  it('sums the segments', () => {
    const pts = [
      { lat: 0, lon: 0 },
      { lat: 0, lon: 1 },
      { lat: 0, lon: 2 },
    ];
    const total = polylineLengthMeters(pts);
    const seg =
      haversineMeters(pts[0]!, pts[1]!) + haversineMeters(pts[1]!, pts[2]!);
    expect(total).toBeCloseTo(seg, 6);
  });
});

describe('cumulativeDistances', () => {
  it('starts at 0 and ends at the total length', () => {
    const pts = [
      { lat: 0, lon: 0 },
      { lat: 0, lon: 1 },
      { lat: 0, lon: 2 },
    ];
    const cum = cumulativeDistances(pts);
    expect(cum).toHaveLength(3);
    expect(cum[0]).toBe(0);
    expect(cum[2]).toBeCloseTo(polylineLengthMeters(pts), 6);
    expect(cum[1]).toBeLessThan(cum[2]!);
  });
});

describe('lerpPoint', () => {
  it('returns the endpoints at t=0 and t=1', () => {
    const a = { lat: 1, lon: 2 };
    const b = { lat: 3, lon: 6 };
    expect(lerpPoint(a, b, 0)).toEqual(a);
    expect(lerpPoint(a, b, 1)).toEqual(b);
  });

  it('returns the midpoint at t=0.5', () => {
    expect(lerpPoint({ lat: 0, lon: 0 }, { lat: 2, lon: 4 }, 0.5)).toEqual({
      lat: 1,
      lon: 2,
    });
  });
});

describe('pointAtDistance', () => {
  const pts = [
    { lat: 0, lon: 0 },
    { lat: 0, lon: 1 },
    { lat: 0, lon: 2 },
  ];
  const cum = cumulativeDistances(pts);

  it('clamps below 0 to the first vertex', () => {
    expect(pointAtDistance(pts, cum, -100)).toEqual(pts[0]);
  });

  it('clamps beyond the end to the last vertex', () => {
    const p = pointAtDistance(pts, cum, cum[2]! + 1000);
    expect(p.lon).toBeCloseTo(2, 6);
  });

  it('lands halfway at half the total distance', () => {
    const p = pointAtDistance(pts, cum, cum[2]! / 2);
    expect(p.lon).toBeCloseTo(1, 3);
  });

  it('throws on an empty polyline', () => {
    expect(() => pointAtDistance([], [], 0)).toThrow();
  });

  it('returns the only point for a single-vertex polyline', () => {
    expect(pointAtDistance([{ lat: 5, lon: 5 }], [0], 10)).toEqual({
      lat: 5,
      lon: 5,
    });
  });
});
