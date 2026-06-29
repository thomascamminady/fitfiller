import { describe, it, expect } from 'vitest';
import { Encoder, Profile } from '@garmin/fitsdk';
import { decodeFit } from '../fit/decode.js';
import { encodeFit } from '../fit/encode.js';
import { buildGapFill, straightRoute } from '../gap/fill.js';
import { degreesToSemicircles } from '../fit/semicircles.js';

const MesgNum = Profile.MesgNum;
const BASE = Date.UTC(2026, 0, 1, 8, 0, 0);

/**
 * Build a tiny activity: 5s of running, a 60s timer pause during which the
 * athlete actually moved ~600m, then 5s more running.
 */
function buildFitBytes(): Uint8Array {
  const enc = new Encoder();
  enc.writeMesg({
    mesgNum: MesgNum.FILE_ID,
    type: 'activity',
    timeCreated: new Date(BASE),
    manufacturer: 'development',
    product: 0,
    serialNumber: 1234,
  } as never);

  const rec = (sec: number, lat: number, lon: number, dist: number) =>
    enc.writeMesg({
      mesgNum: MesgNum.RECORD,
      timestamp: new Date(BASE + sec * 1000),
      positionLat: degreesToSemicircles(lat),
      positionLong: degreesToSemicircles(lon),
      distance: dist,
      enhancedSpeed: 3,
      enhancedAltitude: 100 + sec,
      heartRate: 150,
      cadence: 85,
    } as never);

  // Pre-pause: moving east from lon 8.0000.
  for (let s = 0; s <= 4; s++) rec(s, 47.0, 8.0 + s * 0.0001, s * 7.6);

  // Timer pause from t=4 to t=64.
  enc.writeMesg({
    mesgNum: MesgNum.EVENT,
    timestamp: new Date(BASE + 4000),
    event: 'timer',
    eventType: 'stop',
  } as never);
  enc.writeMesg({
    mesgNum: MesgNum.EVENT,
    timestamp: new Date(BASE + 64000),
    event: 'timer',
    eventType: 'start',
  } as never);

  // Post-pause: resumes ~600m further east. Watch distance continues from 30.4.
  for (let s = 0; s <= 4; s++)
    rec(64 + s, 47.0, 8.006 + s * 0.0001, 30.4 + s * 7.6);

  enc.writeMesg({
    mesgNum: MesgNum.SESSION,
    timestamp: new Date(BASE + 68000),
    startTime: new Date(BASE),
    sport: 'running',
    totalDistance: 60.8,
    totalTimerTime: 9,
  } as never);

  return enc.close();
}

describe('fitfiller round-trip', () => {
  it('decodes records, events and a pause', () => {
    const { activity } = decodeFit(buildFitBytes());
    expect(activity.points).toHaveLength(10);
    expect(activity.pauses).toHaveLength(1);
    const pause = activity.pauses[0]!;
    expect(pause.pausedSeconds).toBe(60);
    expect(pause.before.time).toBe(BASE + 4000);
    expect(pause.after.time).toBe(BASE + 64000);
    expect(pause.straightLineMeters).toBeGreaterThan(400);
  });

  it('fills a gap and re-encodes a valid FIT with extra records', () => {
    const original = buildFitBytes();
    const { raw, activity } = decodeFit(original);
    const pause = activity.pauses[0]!;

    const fill = buildGapFill({
      pause,
      route: straightRoute(pause),
      config: {
        actualBreakSeconds: 10,
        sampleSeconds: 5,
        heartRate: { mode: 'average' },
        cadence: { mode: 'average' },
        elevation: { mode: 'linear' },
      },
    });

    expect(fill.records.length).toBeGreaterThan(0);
    expect(fill.movingSeconds).toBe(50);
    expect(fill.addedDistanceMeters).toBeGreaterThan(400);

    const out = encodeFit(raw, [fill]);
    const redecoded = decodeFit(out);

    // More records than the original 10, and the pause is now gone.
    expect(redecoded.activity.points.length).toBeGreaterThan(10);
    expect(redecoded.activity.pauses).toHaveLength(0);

    // Synthetic records fall inside the old gap window and carry filled data.
    const inGap = redecoded.activity.points.filter(
      (p) => p.time > BASE + 4000 && p.time < BASE + 64000,
    );
    expect(inGap.length).toBeGreaterThan(0);
    for (const p of inGap) {
      expect(p.heartRate).toBe(150);
      expect(p.cadence).toBe(85);
      expect(p.lat).not.toBeNull();
    }

    // Distance is monotonic non-decreasing across the whole activity.
    const dists = redecoded.activity.points
      .map((p) => p.distance)
      .filter((d): d is number => d !== null);
    for (let i = 1; i < dists.length; i++) {
      expect(dists[i]!).toBeGreaterThanOrEqual(dists[i - 1]! - 1e-6);
    }
  });
});
