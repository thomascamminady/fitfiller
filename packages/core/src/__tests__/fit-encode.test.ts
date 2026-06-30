import { describe, it, expect } from 'vitest';
import { decodeFit } from '../fit/decode.js';
import { encodeFit } from '../fit/encode.js';
import { buildGapFill, straightRoute } from '../gap/fill.js';
import { runWithPause, buildFit } from './fixtures.js';

describe('encodeFit — fidelity (no fills)', () => {
  it('round-trips records and distances unchanged', () => {
    const { raw, activity } = decodeFit(runWithPause());
    const out = encodeFit(raw, []);
    const again = decodeFit(out);

    expect(again.activity.points).toHaveLength(activity.points.length);
    const origDist = activity.points.map((p) => p.distance);
    const newDist = again.activity.points.map((p) => p.distance);
    expect(newDist).toEqual(origDist);
    // Pause is untouched when nothing is filled.
    expect(again.activity.pauses).toHaveLength(1);
  });
});

describe('encodeFit — with a fill', () => {
  it('removes the pause, adds records and shifts later distances', () => {
    const original = decodeFit(runWithPause());
    const pause = original.activity.pauses[0]!;
    const fill = buildGapFill({
      pause,
      route: straightRoute(pause),
      config: { actualBreakSeconds: 10, sampleSeconds: 5 },
    });
    const out = encodeFit(original.raw, [fill]);
    const filled = decodeFit(out);

    expect(filled.activity.pauses).toHaveLength(0);
    expect(filled.activity.points.length).toBeGreaterThan(
      original.activity.points.length,
    );

    // Distance is monotonic non-decreasing across the whole file.
    const dists = filled.activity.points
      .map((p) => p.distance)
      .filter((d): d is number => d !== null);
    for (let i = 1; i < dists.length; i++) {
      expect(dists[i]!).toBeGreaterThanOrEqual(dists[i - 1]! - 1e-6);
    }

    // The original timer stop/start events are gone.
    expect(
      filled.activity.events.filter((e) => e.type === 'stop'),
    ).toHaveLength(0);
  });

  it('adjusts the session total distance and timer time', () => {
    const original = decodeFit(runWithPause());
    const pause = original.activity.pauses[0]!;
    const fill = buildGapFill({
      pause,
      route: straightRoute(pause),
      config: { actualBreakSeconds: 10 },
    });
    const out = encodeFit(original.raw, [fill]);
    const filled = decodeFit(out);

    expect(filled.activity.summary.totalDistanceMeters!).toBeGreaterThan(
      original.activity.summary.totalDistanceMeters!,
    );
    expect(filled.activity.summary.totalTimerSeconds!).toBeGreaterThan(
      original.activity.summary.totalTimerSeconds!,
    );
  });

  it('updates session totals even when session.timestamp equals startTime', () => {
    // Some devices set session.timestamp to the *start* time. Totals must still
    // grow, derived from elapsed/timer time rather than the bogus timestamp.
    const records = [];
    for (let s = 0; s <= 5; s++)
      records.push({ sec: s, lat: 47, lon: 8 + s * 1e-4, dist: s * 5 });
    for (let s = 0; s <= 5; s++)
      records.push({
        sec: 70 + s,
        lat: 47,
        lon: 8.006 + s * 1e-4,
        dist: 25 + s * 5,
      });
    const bytes = buildFit({
      records,
      events: [
        { sec: 5, type: 'stop' },
        { sec: 70, type: 'start' },
      ],
      // endSec = 0 makes session.timestamp == startTime (the quirk).
      session: {
        startSec: 0,
        endSec: 0,
        totalDistance: 50,
        totalTimerTime: 12,
      },
    });
    const dec = decodeFit(bytes);
    const pause = dec.activity.pauses[0]!;
    const fill = buildGapFill({
      pause,
      route: straightRoute(pause),
      config: { actualBreakSeconds: 5 },
    });
    const filled = decodeFit(encodeFit(dec.raw, [fill]));

    expect(filled.activity.summary.totalDistanceMeters!).toBeGreaterThan(50);
    expect(filled.activity.summary.totalTimerSeconds!).toBeGreaterThan(12);
  });

  it('accumulates distance shift across two filled gaps', () => {
    // Build a run with two forgotten pauses.
    const records = [];
    for (let s = 0; s <= 5; s++)
      records.push({
        sec: s,
        lat: 47,
        lon: 8 + s * 0.0001,
        dist: s * 5,
        alt: 100,
        hr: 150,
        cad: 85,
      });
    for (let s = 0; s <= 5; s++)
      records.push({
        sec: 65 + s,
        lat: 47,
        lon: 8.006 + s * 0.0001,
        dist: 25 + s * 5,
        alt: 100,
        hr: 150,
        cad: 85,
      });
    for (let s = 0; s <= 5; s++)
      records.push({
        sec: 130 + s,
        lat: 47,
        lon: 8.012 + s * 0.0001,
        dist: 50 + s * 5,
        alt: 100,
        hr: 150,
        cad: 85,
      });
    const bytes = buildFit({
      records,
      events: [
        { sec: 5, type: 'stop' },
        { sec: 65, type: 'start' },
        { sec: 70, type: 'stop' },
        { sec: 130, type: 'start' },
      ],
      session: { endSec: 135, totalDistance: 75, totalTimerTime: 18 },
    });
    const decoded = decodeFit(bytes);
    expect(decoded.activity.pauses).toHaveLength(2);

    const fills = decoded.activity.pauses.map((p) =>
      buildGapFill({
        pause: p,
        route: straightRoute(p),
        config: { actualBreakSeconds: 5 },
      }),
    );
    const filled = decodeFit(encodeFit(decoded.raw, fills));

    expect(filled.activity.pauses).toHaveLength(0);
    const totalAdded = fills.reduce((s, f) => s + f.addedDistanceMeters, 0);
    const lastDist = filled.activity.points.at(-1)!.distance!;
    // Final distance reflects both gaps' added distance on top of the recorded 75 m.
    expect(lastDist).toBeGreaterThan(75 + totalAdded - 1);
  });
});
