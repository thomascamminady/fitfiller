import { describe, it, expect, vi, afterEach } from 'vitest';
import { Encoder, Profile } from '@garmin/fitsdk';
import { degreesToSemicircles } from '@fitfiller/core';
import { api, ApiError } from './api';
import type { FillRequest, PauseSegment } from './types';

const M = Profile.MesgNum;
const BASE = Date.UTC(2026, 0, 1, 8, 0, 0);

/** A running .fit with one forgotten ~600 m pause. */
function sampleFit(): File {
  const enc = new Encoder();
  enc.writeMesg({
    mesgNum: M.FILE_ID,
    type: 'activity',
    timeCreated: new Date(BASE),
    manufacturer: 'development',
    product: 0,
    serialNumber: 1,
  } as never);
  const rec = (s: number, lon: number, d: number) =>
    enc.writeMesg({
      mesgNum: M.RECORD,
      timestamp: new Date(BASE + s * 1000),
      positionLat: degreesToSemicircles(47),
      positionLong: degreesToSemicircles(lon),
      distance: d,
      enhancedSpeed: 3,
      enhancedAltitude: 100 + s,
      heartRate: 150,
      cadence: 85,
    } as never);
  for (let s = 0; s <= 4; s++) rec(s, 8 + s * 1e-4, s * 7.6);
  enc.writeMesg({
    mesgNum: M.EVENT,
    timestamp: new Date(BASE + 4000),
    event: 'timer',
    eventType: 'stop',
  } as never);
  enc.writeMesg({
    mesgNum: M.EVENT,
    timestamp: new Date(BASE + 64000),
    event: 'timer',
    eventType: 'start',
  } as never);
  for (let s = 0; s <= 4; s++) rec(64 + s, 8.006 + s * 1e-4, 30.4 + s * 7.6);
  enc.writeMesg({
    mesgNum: M.SESSION,
    timestamp: new Date(BASE + 68000),
    startTime: new Date(BASE),
    sport: 'running',
    totalDistance: 60.8,
    totalTimerTime: 9,
  } as never);
  // jsdom's File lacks arrayBuffer(); provide a minimal File-like for the test
  // (real browsers implement it — the Playwright run exercises the real path).
  const bytes = enc.close();
  const buffer = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  );
  return {
    name: 'run.fit',
    arrayBuffer: async () => buffer,
  } as unknown as File;
}

function fillFor(pause: PauseSegment, snapToPath = false): FillRequest {
  return {
    pauseId: pause.id,
    route: [
      { lat: pause.before.lat!, lon: pause.before.lon! },
      { lat: pause.after.lat!, lon: pause.after.lon! },
    ],
    config: { actualBreakSeconds: 0, snapToPath },
  };
}

afterEach(() => vi.unstubAllGlobals());

describe('client engine', () => {
  it('decodes an upload into an activity with a pause', async () => {
    const up = await api.upload(sampleFit());
    expect(up.filename).toBe('run.fit');
    expect(up.activity.pauses).toHaveLength(1);
    expect(up.activity.summary.sport).toBe('running');
  });

  it('previews a fill and exports a valid file', async () => {
    const up = await api.upload(sampleFit());
    const fill = await api.previewFill(up.id, fillFor(up.activity.pauses[0]!));
    expect(fill.records.length).toBeGreaterThan(0);
    expect(fill.addedDistanceMeters).toBeGreaterThan(0);
    const blob = await api.export(up.id, [fillFor(up.activity.pauses[0]!)]);
    expect(blob.size).toBeGreaterThan(100);
  });

  it('summarises the export with an integrity check and diff', async () => {
    const up = await api.upload(sampleFit());
    const s = await api.exportSummary(up.id, [fillFor(up.activity.pauses[0]!)]);
    expect(s.ok).toBe(true);
    expect(s.delta.pausesRemoved).toBe(1);
    expect(s.filled.points).toBeGreaterThan(s.original.points);
  });

  it('throws ApiError(404) for an unknown activity id', async () => {
    const up = await api.upload(sampleFit());
    await expect(
      api.previewFill('nope', fillFor(up.activity.pauses[0]!)),
    ).rejects.toBeInstanceOf(ApiError);
  });

  it('routes the gap along a snapped path when snapToPath is set', async () => {
    const up = await api.upload(sampleFit());
    const pause = up.activity.pauses[0]!;
    const fetchMock = vi.fn(
      async () =>
        ({
          ok: true,
          json: async () => ({
            features: [
              {
                geometry: {
                  coordinates: [
                    [pause.before.lon, pause.before.lat, 100],
                    [8.02, 47.02, 110], // a detour off the straight line
                    [pause.after.lon, pause.after.lat, 120],
                  ],
                },
              },
            ],
          }),
        }) as unknown as Response,
    );
    vi.stubGlobal('fetch', fetchMock);

    const straight = await api.previewFill(up.id, fillFor(pause, false));
    const snapped = await api.previewFill(up.id, fillFor(pause, true));

    expect(fetchMock).toHaveBeenCalled();
    expect(snapped.addedDistanceMeters).toBeGreaterThan(
      straight.addedDistanceMeters,
    );
  });
});
