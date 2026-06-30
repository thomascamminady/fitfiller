import { describe, it, expect } from 'vitest';
import { detectPauses } from '../pause/detect.js';
import type { TrackPoint, TimerEvent } from '../domain/types.js';

const T0 = 1_000_000_000_000;

function pt(
  sec: number,
  lat: number | null = 47,
  lon: number | null = 8,
): TrackPoint {
  return {
    time: T0 + sec * 1000,
    lat,
    lon,
    altitude: 100,
    distance: sec * 3,
    speed: 3,
    heartRate: 150,
    cadence: 85,
  };
}

function ev(sec: number, type: TimerEvent['type']): TimerEvent {
  return { time: T0 + sec * 1000, type };
}

describe('detectPauses — event driven', () => {
  it('creates one pause from a stop/start pair', () => {
    const points = [
      pt(0),
      pt(5, 47, 8.0001),
      pt(65, 47, 8.006),
      pt(70, 47, 8.0061),
    ];
    const events = [ev(5, 'stop'), ev(65, 'start')];
    const pauses = detectPauses(points, events);
    expect(pauses).toHaveLength(1);
    const p = pauses[0]!;
    expect(p.index).toBe(0);
    expect(p.id).toBe('pause-0');
    expect(p.stopTime).toBe(T0 + 5000);
    expect(p.startTime).toBe(T0 + 65000);
    expect(p.pausedSeconds).toBe(60);
    expect(p.before.time).toBe(T0 + 5000);
    expect(p.after.time).toBe(T0 + 65000);
    expect(p.straightLineMeters).toBeGreaterThan(0);
  });

  it('treats stopAll like stop', () => {
    const points = [pt(0), pt(5), pt(65), pt(70)];
    const pauses = detectPauses(points, [ev(5, 'stopAll'), ev(65, 'start')]);
    expect(pauses).toHaveLength(1);
  });

  it('ignores a stop with no matching start', () => {
    const points = [pt(0), pt(5), pt(10)];
    expect(detectPauses(points, [ev(5, 'stop')])).toHaveLength(0);
  });

  it('orders and indexes multiple pauses', () => {
    const points = [pt(0), pt(5), pt(65), pt(70), pt(130), pt(135)];
    const events = [
      ev(5, 'stop'),
      ev(65, 'start'),
      ev(70, 'stop'),
      ev(130, 'start'),
    ];
    const pauses = detectPauses(points, events);
    expect(pauses.map((p) => p.index)).toEqual([0, 1]);
    expect(pauses[0]!.stopTime).toBeLessThan(pauses[1]!.stopTime);
  });
});

describe('detectPauses — time-gap fallback', () => {
  it('flags a large gap with no timer events', () => {
    const points = [pt(0), pt(1), pt(2), pt(62, 47, 8.006), pt(63)];
    const pauses = detectPauses(points, []);
    expect(pauses).toHaveLength(1);
    expect(pauses[0]!.pausedSeconds).toBe(60);
  });

  it('ignores small gaps below the threshold', () => {
    const points = [pt(0), pt(3), pt(6), pt(9)];
    expect(detectPauses(points, [])).toHaveLength(0);
  });

  it('respects a custom minGapSeconds', () => {
    const points = [pt(0), pt(4), pt(8)];
    expect(detectPauses(points, [], { minGapSeconds: 3 })).toHaveLength(2);
  });

  it('does not double-count a gap already covered by an event pair', () => {
    const points = [pt(0), pt(5), pt(65), pt(70)];
    const events = [ev(5, 'stop'), ev(65, 'start')];
    expect(detectPauses(points, events)).toHaveLength(1);
  });
});

describe('detectPauses — edge cases', () => {
  it('returns nothing for an empty activity', () => {
    expect(detectPauses([], [])).toHaveLength(0);
  });

  it('reports zero straight-line distance when GPS is missing', () => {
    const points = [
      pt(0, null, null),
      pt(5, null, null),
      pt(65, null, null),
      pt(70, null, null),
    ];
    const pauses = detectPauses(points, [ev(5, 'stop'), ev(65, 'start')]);
    expect(pauses[0]!.straightLineMeters).toBe(0);
  });
});
