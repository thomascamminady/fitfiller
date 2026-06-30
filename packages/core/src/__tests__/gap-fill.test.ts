import { describe, it, expect } from 'vitest';
import {
  buildGapFill,
  straightRoute,
  routeDistanceMeters,
} from '../gap/fill.js';
import { polylineLengthMeters } from '../geo/distance.js';
import type { GeoPoint, PauseSegment, TrackPoint } from '../domain/types.js';

const T0 = 1_000_000_000_000;

function pt(over: Partial<TrackPoint>): TrackPoint {
  return {
    time: T0,
    lat: 47,
    lon: 8,
    altitude: 100,
    distance: 100,
    speed: 3,
    heartRate: 150,
    cadence: 85,
    ...over,
  };
}

function pause(over: Partial<PauseSegment> = {}): PauseSegment {
  const before = pt({
    time: T0,
    lon: 8.0,
    distance: 100,
    altitude: 100,
    heartRate: 140,
    cadence: 80,
  });
  const after = pt({
    time: T0 + 60_000,
    lon: 8.006,
    distance: 100,
    altitude: 160,
    heartRate: 160,
    cadence: 90,
  });
  return {
    id: 'pause-0',
    index: 0,
    stopTime: T0,
    startTime: T0 + 60_000,
    pausedSeconds: 60,
    before,
    after,
    straightLineMeters: 450,
    ...over,
  };
}

const straight: GeoPoint[] = [
  { lat: 47, lon: 8.0 },
  { lat: 47, lon: 8.006 },
];

describe('buildGapFill — geometry & timing', () => {
  it('adds the route distance and computes moving time', () => {
    const fill = buildGapFill({
      pause: pause(),
      route: straight,
      config: { actualBreakSeconds: 10 },
    });
    expect(fill.addedDistanceMeters).toBeCloseTo(
      polylineLengthMeters(straight),
      3,
    );
    expect(fill.movingSeconds).toBe(50);
    expect(fill.stopTime).toBe(T0);
    expect(fill.startTime).toBe(T0 + 60_000);
    expect(fill.dropTimerEvents).toBe(true);
  });

  it('produces records that stay within the gap window', () => {
    const fill = buildGapFill({
      pause: pause(),
      route: straight,
      config: { actualBreakSeconds: 0 },
    });
    expect(fill.records.length).toBeGreaterThan(0);
    for (const r of fill.records) {
      expect(r.time).toBeGreaterThan(T0);
      expect(r.time).toBeLessThan(T0 + 60_000);
    }
  });

  it('keeps cumulative distance monotonic between the endpoints', () => {
    const fill = buildGapFill({
      pause: pause(),
      route: straight,
      config: { actualBreakSeconds: 5 },
    });
    const base = 100;
    let prev = base;
    for (const r of fill.records) {
      expect(r.distance!).toBeGreaterThanOrEqual(prev - 1e-6);
      prev = r.distance!;
    }
    expect(prev).toBeLessThanOrEqual(base + fill.addedDistanceMeters + 1e-6);
  });

  it('holds position still and speed at zero during the break', () => {
    const fill = buildGapFill({
      pause: pause(),
      route: straight,
      config: { actualBreakSeconds: 20, sampleSeconds: 5 },
    });
    const breakRecords = fill.records.filter((r) => r.time <= T0 + 20_000);
    expect(breakRecords.length).toBeGreaterThan(0);
    for (const r of breakRecords) {
      expect(r.speed).toBe(0);
      expect(r.lon).toBeCloseTo(8.0, 6);
      expect(r.distance).toBeCloseTo(100, 6);
    }
  });

  it('clamps an over-long break so moving time stays >= 1s', () => {
    const fill = buildGapFill({
      pause: pause(),
      route: straight,
      config: { actualBreakSeconds: 999 },
    });
    expect(fill.movingSeconds).toBeGreaterThanOrEqual(1);
  });

  it('leaves distance null when the source had no distance', () => {
    const noDist = pause({
      before: pt({ lon: 8.0, distance: null }),
      after: pt({ time: T0 + 60_000, lon: 8.006, distance: null }),
    });
    const fill = buildGapFill({
      pause: noDist,
      route: straight,
      config: { actualBreakSeconds: 0 },
    });
    for (const r of fill.records) expect(r.distance).toBeNull();
  });
});

describe('buildGapFill — field filling', () => {
  it('averages heart rate and cadence from the endpoints', () => {
    const fill = buildGapFill({
      pause: pause(),
      route: straight,
      config: {
        actualBreakSeconds: 0,
        heartRate: { mode: 'average' },
        cadence: { mode: 'average' },
      },
    });
    const moving = fill.records.find((r) => r.speed && r.speed > 0)!;
    expect(moving.heartRate).toBe(150); // (140 + 160) / 2
    expect(moving.cadence).toBe(85); // (80 + 90) / 2
  });

  it('uses a fixed value when mode=value', () => {
    const fill = buildGapFill({
      pause: pause(),
      route: straight,
      config: {
        actualBreakSeconds: 0,
        heartRate: { mode: 'value', value: 172 },
      },
    });
    expect(fill.records[0]!.heartRate).toBe(172);
  });

  it('leaves fields null when mode=none', () => {
    const fill = buildGapFill({
      pause: pause(),
      route: straight,
      config: {
        actualBreakSeconds: 0,
        heartRate: { mode: 'none' },
        cadence: { mode: 'none' },
      },
    });
    expect(fill.records[0]!.heartRate).toBeNull();
    expect(fill.records[0]!.cadence).toBeNull();
  });

  it('interpolates elevation linearly between endpoints', () => {
    const fill = buildGapFill({
      pause: pause(),
      route: straight,
      config: { actualBreakSeconds: 0, elevation: { mode: 'linear' } },
    });
    const alts = fill.records.map((r) => r.altitude!);
    expect(Math.min(...alts)).toBeGreaterThanOrEqual(100 - 1e-6);
    expect(Math.max(...alts)).toBeLessThanOrEqual(160 + 1e-6);
    // Monotonically rising 100 -> 160.
    for (let i = 1; i < alts.length; i++) {
      expect(alts[i]!).toBeGreaterThanOrEqual(alts[i - 1]! - 1e-6);
    }
  });

  it('samples provided route elevation when mode=route', () => {
    const route: GeoPoint[] = [
      { lat: 47, lon: 8.0 },
      { lat: 47, lon: 8.003 },
      { lat: 47, lon: 8.006 },
    ];
    const fill = buildGapFill({
      pause: pause(),
      route,
      routeElevations: [200, 250, 210],
      config: { actualBreakSeconds: 0, elevation: { mode: 'route' } },
    });
    const alts = fill.records.map((r) => r.altitude!);
    // The mid-route peak (250) should exceed both ends.
    expect(Math.max(...alts)).toBeGreaterThan(210);
  });
});

describe('buildGapFill — grade adjustment (premium)', () => {
  it('varies speed by grade when elevation is supplied', () => {
    const route: GeoPoint[] = [
      { lat: 47, lon: 8.0 },
      { lat: 47, lon: 8.003 },
      { lat: 47, lon: 8.006 },
    ];
    const constant = buildGapFill({
      pause: pause(),
      route,
      routeElevations: [100, 140, 100],
      config: { actualBreakSeconds: 0, gradeAdjust: false },
    });
    const adjusted = buildGapFill({
      pause: pause(),
      route,
      routeElevations: [100, 140, 100],
      config: { actualBreakSeconds: 0, gradeAdjust: true },
    });
    const spread = (f: typeof adjusted) => {
      const s = f.records.map((r) => r.speed!).filter((v) => v > 0);
      return Math.max(...s) - Math.min(...s);
    };
    // Constant pace → near-uniform speed; grade-adjusted → noticeably variable.
    expect(spread(constant)).toBeLessThan(0.5);
    expect(spread(adjusted)).toBeGreaterThan(spread(constant));
  });
});

describe('route helpers', () => {
  it('straightRoute returns the two endpoints', () => {
    const r = straightRoute(pause());
    expect(r).toHaveLength(2);
    expect(r[0]).toEqual({ lat: 47, lon: 8.0 });
  });

  it('straightRoute throws when an endpoint lacks GPS', () => {
    expect(() =>
      straightRoute(pause({ before: pt({ lat: null, lon: null }) })),
    ).toThrow();
  });

  it('buildGapFill throws on a degenerate route', () => {
    expect(() =>
      buildGapFill({
        pause: pause(),
        route: [{ lat: 47, lon: 8 }],
        config: { actualBreakSeconds: 0 },
      }),
    ).toThrow();
  });

  it('routeDistanceMeters matches polylineLengthMeters', () => {
    expect(routeDistanceMeters(straight)).toBeCloseTo(
      polylineLengthMeters(straight),
      6,
    );
  });
});
