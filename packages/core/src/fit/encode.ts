import { Encoder, Profile } from '@garmin/fitsdk';
import type { TrackPoint } from '../domain/types.js';
import type { GapFill } from '../gap/fill.js';
import type { RawMessage } from './decode.js';
import { degreesToSemicircles } from './semicircles.js';

const RECORD = Profile.MesgNum.RECORD as number;
const EVENT = Profile.MesgNum.EVENT as number;
const SESSION = Profile.MesgNum.SESSION as number;
const LAP = Profile.MesgNum.LAP as number;

const timeOf = (mesg: Record<string, unknown>): number | null =>
  mesg.timestamp instanceof Date ? mesg.timestamp.getTime() : null;

function pointToRecordMesg(p: TrackPoint): Record<string, unknown> {
  // Field order matches the order the decoder emits record fields. The encoder
  // reuses a local message definition for records with the same field set, so a
  // mismatched key order would write values into the wrong field slots.
  const m: Record<string, unknown> = { timestamp: new Date(p.time) };
  if (p.lat !== null) m.positionLat = degreesToSemicircles(p.lat);
  if (p.lon !== null) m.positionLong = degreesToSemicircles(p.lon);
  if (p.distance !== null) m.distance = p.distance;
  if (p.speed !== null) m.enhancedSpeed = p.speed;
  if (p.altitude !== null) m.enhancedAltitude = p.altitude;
  if (p.heartRate !== null) m.heartRate = p.heartRate;
  if (p.cadence !== null) m.cadence = p.cadence;
  m.mesgNum = RECORD;
  return m;
}

/** Times (epoch ms) of timer events to remove because their gap was filled. */
function droppedEventTimes(fills: GapFill[]): Set<number> {
  const times = new Set<number>();
  for (const f of fills) {
    if (!f.dropTimerEvents) continue;
    times.add(f.stopTime);
    times.add(f.startTime);
  }
  return times;
}

/**
 * Re-encode an activity, splicing in filled gaps.
 *
 * Transformations applied:
 *  - synthetic records are merged into the record stream in time order;
 *  - every record at/after a filled gap has its cumulative `distance` shifted
 *    by the gap's added distance;
 *  - the timer stop/start events bracketing a filled gap are removed so the
 *    activity reads as continuous moving time;
 *  - `session`/`lap` totals are adjusted for the added distance and time.
 *
 * All other messages pass through unchanged. Messages are emitted ordered by
 * timestamp (untimestamped messages such as `file_id` come first), which is a
 * valid FIT layout that activity platforms accept.
 */
export function encodeFit(raw: RawMessage[], fills: GapFill[]): Uint8Array {
  const encoder = new Encoder();
  const dropTimes = droppedEventTimes(fills);

  // Distance added to any record occurring at or after a fill's resume time.
  const distanceShiftAt = (time: number): number => {
    let shift = 0;
    for (const f of fills) {
      if (f.startTime <= time) shift += f.addedDistanceMeters;
    }
    return shift;
  };

  interface Entry {
    mesgNum: number;
    mesg: Record<string, unknown>;
    time: number | null;
    order: number;
  }

  const untimed: Entry[] = [];
  const timed: Entry[] = [];
  let order = 0;

  for (const { mesgNum, mesg } of raw) {
    const time = timeOf(mesg);

    // Drop the timer events bracketing filled gaps.
    if (
      mesgNum === EVENT &&
      mesg.event === 'timer' &&
      time !== null &&
      dropTimes.has(time)
    ) {
      continue;
    }

    const clone: Record<string, unknown> = { ...mesg, mesgNum };

    if (mesgNum === RECORD && time !== null) {
      const shift = distanceShiftAt(time);
      if (shift !== 0 && typeof clone.distance === 'number') {
        clone.distance = clone.distance + shift;
      }
    } else if (mesgNum === SESSION || mesgNum === LAP) {
      adjustTotals(clone, fills);
    }

    const entry: Entry = { mesgNum, mesg: clone, time, order: order++ };
    if (time === null) untimed.push(entry);
    else timed.push(entry);
  }

  // Splice synthetic records into the timed stream.
  for (const f of fills) {
    for (const p of f.records) {
      const mesg = pointToRecordMesg(p);
      // Synthetic distance is absolute-from-start; add earlier gaps' shift.
      const shift = distanceShiftAt(p.time);
      if (shift !== 0 && typeof mesg.distance === 'number') {
        mesg.distance = mesg.distance + shift;
      }
      timed.push({ mesgNum: RECORD, mesg, time: p.time, order: order++ });
    }
  }

  timed.sort((a, b) => a.time! - b.time! || a.order - b.order);

  for (const e of untimed) encoder.writeMesg(e.mesg as never);
  for (const e of timed) encoder.writeMesg(e.mesg as never);

  return encoder.close();
}

/** Add gap distance/time to a session or lap whose window contains the gap. */
function adjustTotals(mesg: Record<string, unknown>, fills: GapFill[]): void {
  const end = mesg.timestamp instanceof Date ? mesg.timestamp.getTime() : null;
  const start =
    mesg.startTime instanceof Date ? mesg.startTime.getTime() : null;
  if (end === null) return;
  let addDistance = 0;
  let addTime = 0;
  for (const f of fills) {
    const within =
      f.startTime <= end && (start === null || f.startTime >= start);
    if (within) {
      addDistance += f.addedDistanceMeters;
      addTime += f.movingSeconds;
    }
  }
  if (addDistance === 0 && addTime === 0) return;
  if (typeof mesg.totalDistance === 'number') {
    mesg.totalDistance = mesg.totalDistance + addDistance;
  }
  if (typeof mesg.totalTimerTime === 'number') {
    mesg.totalTimerTime = mesg.totalTimerTime + addTime;
  }
}
