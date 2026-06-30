import { Encoder, Profile } from '@garmin/fitsdk';
import { degreesToSemicircles } from '../fit/semicircles.js';

const M = Profile.MesgNum;

/** Epoch ms anchor used by all fixtures so tests can reason about times. */
export const BASE = Date.UTC(2026, 0, 1, 8, 0, 0);

export interface SimRecord {
  /** Seconds after BASE. */
  sec: number;
  lat?: number;
  lon?: number;
  /** Cumulative distance, metres. */
  dist?: number;
  speed?: number;
  alt?: number;
  hr?: number;
  cad?: number;
}

export interface SimTimerEvent {
  sec: number;
  type: 'start' | 'stop' | 'stopAll';
}

export interface SimSession {
  totalDistance?: number;
  totalTimerTime?: number;
  sport?: string;
  startSec?: number;
  endSec: number;
}

export interface SimLap {
  startSec: number;
  endSec: number;
  distance?: number;
  timer?: number;
}

export interface BuildFitOptions {
  records: SimRecord[];
  events?: SimTimerEvent[];
  laps?: SimLap[];
  session?: SimSession;
  /** Omit the file_id message (to produce an invalid-ish file). */
  noFileId?: boolean;
}

/** Build a FIT byte array from a compact description. Messages are emitted in
 *  chronological order so the decoder sees a realistic file. */
export function buildFit(opts: BuildFitOptions): Uint8Array {
  const enc = new Encoder();
  if (!opts.noFileId) {
    enc.writeMesg({
      mesgNum: M.FILE_ID,
      type: 'activity',
      timeCreated: new Date(BASE),
      manufacturer: 'development',
      product: 0,
      serialNumber: 1,
    } as never);
  }

  type Timed = { sec: number; write: () => void };
  const timeline: Timed[] = [];

  for (const r of opts.records) {
    timeline.push({
      sec: r.sec,
      write: () => {
        const m: Record<string, unknown> = {
          mesgNum: M.RECORD,
          timestamp: new Date(BASE + r.sec * 1000),
        };
        if (r.lat !== undefined) m.positionLat = degreesToSemicircles(r.lat);
        if (r.lon !== undefined) m.positionLong = degreesToSemicircles(r.lon);
        if (r.dist !== undefined) m.distance = r.dist;
        if (r.speed !== undefined) m.enhancedSpeed = r.speed;
        if (r.alt !== undefined) m.enhancedAltitude = r.alt;
        if (r.hr !== undefined) m.heartRate = r.hr;
        if (r.cad !== undefined) m.cadence = r.cad;
        enc.writeMesg(m as never);
      },
    });
  }

  for (const ev of opts.events ?? []) {
    timeline.push({
      sec: ev.sec,
      write: () =>
        enc.writeMesg({
          mesgNum: M.EVENT,
          timestamp: new Date(BASE + ev.sec * 1000),
          event: 'timer',
          eventType: ev.type,
        } as never),
    });
  }

  // Stable sort by time so records/events interleave correctly.
  timeline.sort((a, b) => a.sec - b.sec);
  for (const t of timeline) t.write();

  for (const lap of opts.laps ?? []) {
    enc.writeMesg({
      mesgNum: M.LAP,
      timestamp: new Date(BASE + lap.endSec * 1000),
      startTime: new Date(BASE + lap.startSec * 1000),
      totalDistance: lap.distance ?? 0,
      totalTimerTime: lap.timer ?? lap.endSec - lap.startSec,
    } as never);
  }

  if (opts.session) {
    const s = opts.session;
    enc.writeMesg({
      mesgNum: M.SESSION,
      timestamp: new Date(BASE + s.endSec * 1000),
      startTime: new Date(BASE + (s.startSec ?? 0) * 1000),
      sport: s.sport ?? 'running',
      totalDistance: s.totalDistance ?? 0,
      totalTimerTime: s.totalTimerTime ?? 0,
    } as never);
  }

  return enc.close();
}

/**
 * A FIT file carrying an application-defined (developer) field on a record —
 * the shape produced by apps like Wahoo/TrainingPeaks that previously broke
 * re-encoding.
 */
export function buildFitWithDeveloperField(): Uint8Array {
  const enc = new Encoder();
  enc.writeMesg({
    mesgNum: M.FILE_ID,
    type: 'activity',
    timeCreated: new Date(BASE),
    manufacturer: 'development',
    product: 0,
    serialNumber: 1,
  } as never);
  const devId = {
    developerDataIndex: 0,
    applicationId: Array.from({ length: 16 }, (_, i) => i),
  };
  const fieldDesc = {
    developerDataIndex: 0,
    fieldDefinitionNumber: 0,
    fitBaseTypeId: 1, // uint8
    fieldName: 'doughnuts',
    units: 'count',
  };
  enc.addDeveloperField(
    0,
    { mesgNum: M.DEVELOPER_DATA_ID, ...devId } as never,
    { mesgNum: M.FIELD_DESCRIPTION, ...fieldDesc } as never,
  );
  enc.writeMesg({ mesgNum: M.DEVELOPER_DATA_ID, ...devId } as never);
  enc.writeMesg({ mesgNum: M.FIELD_DESCRIPTION, ...fieldDesc } as never);
  for (let s = 0; s <= 3; s++) {
    enc.writeMesg({
      mesgNum: M.RECORD,
      timestamp: new Date(BASE + s * 1000),
      positionLat: degreesToSemicircles(47),
      positionLong: degreesToSemicircles(8 + s * 1e-4),
      distance: s * 3,
      developerFields: { 0: 5 + s },
    } as never);
  }
  return enc.close();
}

/** A straight eastward run with a single forgotten pause in the middle. */
export function runWithPause(): Uint8Array {
  const records: SimRecord[] = [];
  // 0..10s pre-pause.
  for (let s = 0; s <= 10; s++) {
    records.push({ sec: s, lat: 47, lon: 8 + s * 0.0001, dist: s * 7.6, speed: 3, alt: 100 + s, hr: 150, cad: 85 });
  }
  // Resume 60s later, ~600m further on.
  for (let s = 0; s <= 10; s++) {
    records.push({ sec: 70 + s, lat: 47, lon: 8.006 + s * 0.0001, dist: 76 + s * 7.6, speed: 3, alt: 120 + s, hr: 155, cad: 88 });
  }
  return buildFit({
    records,
    events: [
      { sec: 10, type: 'stop' },
      { sec: 70, type: 'start' },
    ],
    session: { endSec: 80, totalDistance: 152, totalTimerTime: 20 },
  });
}
