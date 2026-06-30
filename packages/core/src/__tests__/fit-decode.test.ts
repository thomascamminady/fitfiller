import { describe, it, expect } from 'vitest';
import { decodeFit } from '../fit/decode.js';
import { runWithPause, buildFit, BASE } from './fixtures.js';

describe('decodeFit', () => {
  it('throws on non-FIT bytes', () => {
    expect(() => decodeFit(new Uint8Array([1, 2, 3, 4, 5]))).toThrow(/FIT/i);
  });

  it('decodes points, events, pauses and summary', () => {
    const { activity, raw } = decodeFit(runWithPause());
    expect(activity.points).toHaveLength(22);
    expect(activity.pauses).toHaveLength(1);
    expect(activity.events.filter((e) => e.type === 'stop')).toHaveLength(1);
    expect(activity.events.filter((e) => e.type === 'start')).toHaveLength(1);

    expect(activity.summary.sport).toBe('running');
    expect(activity.summary.pointCount).toBe(22);
    expect(activity.summary.pauseCount).toBe(1);
    expect(activity.summary.startTime).toBe(BASE);
    expect(activity.summary.totalTimerSeconds).toBe(20);

    // Raw messages are preserved for re-encoding (file_id + records + …).
    expect(raw.length).toBeGreaterThan(activity.points.length);
    expect(raw[0]!.mesg.type).toBe('activity');
  });

  it('normalises positions to decimal degrees', () => {
    const { activity } = decodeFit(runWithPause());
    const first = activity.points[0]!;
    expect(first.lat).toBeCloseTo(47, 4);
    expect(first.lon).toBeCloseTo(8, 4);
  });

  it('handles an activity with no pauses', () => {
    const bytes = buildFit({
      records: Array.from({ length: 6 }, (_, s) => ({
        sec: s,
        lat: 47,
        lon: 8 + s * 0.0001,
        dist: s * 3,
      })),
      session: { endSec: 5 },
    });
    const { activity } = decodeFit(bytes);
    expect(activity.pauses).toHaveLength(0);
  });

  it('keeps null positions for records without GPS', () => {
    const bytes = buildFit({
      records: [
        { sec: 0, dist: 0, hr: 120 },
        { sec: 1, dist: 3, hr: 121 },
      ],
    });
    const { activity } = decodeFit(bytes);
    expect(activity.points[0]!.lat).toBeNull();
    expect(activity.points[0]!.heartRate).toBe(120);
  });

  it('imports laps', () => {
    const bytes = buildFit({
      records: Array.from({ length: 8 }, (_, s) => ({
        sec: s,
        lat: 47,
        lon: 8 + s * 1e-4,
        dist: s * 3,
      })),
      laps: [
        { startSec: 0, endSec: 3, distance: 100, timer: 3 },
        { startSec: 4, endSec: 7, distance: 100, timer: 3 },
      ],
      session: { endSec: 7 },
    });
    const { activity } = decodeFit(bytes);
    expect(activity.laps).toHaveLength(2);
    expect(activity.summary.lapCount).toBe(2);
    expect(activity.laps[0]!.distanceMeters).toBe(100);
    expect(activity.laps[1]!.startTime).toBe(BASE + 4000);
  });
});
