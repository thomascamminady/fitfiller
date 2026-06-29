import { Encoder, Profile } from '@garmin/fitsdk';
import { degreesToSemicircles } from '@fitfiller/core';

const M = Profile.MesgNum;
export const BASE = Date.UTC(2026, 0, 1, 8, 0, 0);

/** A run with one forgotten 60s pause, ~600m of missing ground. */
export function sampleFit(): Buffer {
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
  for (let s = 0; s <= 4; s++) rec(s, 8 + s * 0.0001, s * 7.6);
  enc.writeMesg({ mesgNum: M.EVENT, timestamp: new Date(BASE + 4000), event: 'timer', eventType: 'stop' } as never);
  enc.writeMesg({ mesgNum: M.EVENT, timestamp: new Date(BASE + 64000), event: 'timer', eventType: 'start' } as never);
  for (let s = 0; s <= 4; s++) rec(64 + s, 8.006 + s * 0.0001, 30.4 + s * 7.6);
  enc.writeMesg({
    mesgNum: M.SESSION,
    timestamp: new Date(BASE + 68000),
    startTime: new Date(BASE),
    sport: 'running',
    totalDistance: 60.8,
    totalTimerTime: 9,
  } as never);
  return Buffer.from(enc.close());
}

/** Build a multipart/form-data body for a single file field. */
export function multipart(field: string, filename: string, content: Buffer) {
  const boundary = '----fitfillertest';
  const head = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="${field}"; ` +
      `filename="${filename}"\r\nContent-Type: application/octet-stream\r\n\r\n`,
  );
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
  return {
    headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
    payload: Buffer.concat([head, content, tail]),
  };
}

/** A valid fill request for the sample file's first pause, with a route. */
export function fillRequestFor(pause: {
  id: string;
  before: { lat: number | null; lon: number | null };
  after: { lat: number | null; lon: number | null };
}) {
  return {
    pauseId: pause.id,
    route: [
      { lat: pause.before.lat, lon: pause.before.lon },
      { lat: pause.after.lat, lon: pause.after.lon },
    ],
    config: {
      actualBreakSeconds: 10,
      heartRate: { mode: 'average' as const },
      cadence: { mode: 'average' as const },
      elevation: { mode: 'linear' as const },
    },
  };
}
