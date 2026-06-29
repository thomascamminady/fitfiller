import { Decoder, Stream, Profile } from '@garmin/fitsdk';
import type { Mesg } from '@garmin/fitsdk';
import type {
  ParsedActivity,
  TrackPoint,
  TimerEvent,
  PauseSegment,
  Lap,
} from '../domain/types.js';
import { semicirclesToDegrees } from './semicircles.js';
import { detectPauses } from '../pause/detect.js';

/** A FIT message captured in decode order, ready to be re-encoded. */
export interface RawMessage {
  mesgNum: number;
  /** The decoded message object exactly as produced by the SDK decoder. */
  mesg: Record<string, unknown>;
}

/**
 * The full decode result. {@link raw} preserves every message in file order so
 * the activity can be re-encoded with high fidelity; {@link activity} is the
 * friendly domain projection used by the rest of the app.
 */
export interface DecodedFit {
  raw: RawMessage[];
  activity: ParsedActivity;
}

const RECORD = Profile.MesgNum.RECORD as number;
const EVENT = Profile.MesgNum.EVENT as number;

const num = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? v : null;

const dateMs = (v: unknown): number | null =>
  v instanceof Date ? v.getTime() : null;

function recordToPoint(mesg: Record<string, unknown>): TrackPoint | null {
  const time = dateMs(mesg.timestamp);
  if (time === null) return null;
  const lat = num(mesg.positionLat);
  const lon = num(mesg.positionLong);
  return {
    time,
    lat: lat === null ? null : semicirclesToDegrees(lat),
    lon: lon === null ? null : semicirclesToDegrees(lon),
    altitude: num(mesg.enhancedAltitude) ?? num(mesg.altitude),
    distance: num(mesg.distance),
    speed: num(mesg.enhancedSpeed) ?? num(mesg.speed),
    heartRate: num(mesg.heartRate),
    cadence: num(mesg.cadence),
  };
}

/**
 * Decode a FIT file from raw bytes.
 *
 * @throws if the bytes are not a valid FIT file.
 */
export function decodeFit(bytes: Uint8Array): DecodedFit {
  const stream = Stream.fromByteArray(bytes);
  if (!Decoder.isFIT(stream)) {
    throw new Error('Not a FIT file');
  }
  const decoder = new Decoder(stream);

  const raw: RawMessage[] = [];
  const points: TrackPoint[] = [];
  const events: TimerEvent[] = [];

  const { messages, errors } = decoder.read({
    mesgListener: (mesgNum: number, message: Mesg) => {
      const mesg = message as Record<string, unknown>;
      raw.push({ mesgNum, mesg });
      if (mesgNum === RECORD) {
        const p = recordToPoint(mesg);
        if (p) points.push(p);
      } else if (mesgNum === EVENT) {
        if (mesg.event === 'timer') {
          const time = dateMs(mesg.timestamp);
          if (time !== null) {
            events.push({ time, type: String(mesg.eventType) });
          }
        }
      }
    },
  });

  if (errors.length > 0) {
    // Surface the first decode error but keep whatever we managed to parse;
    // many real-world files have trailing CRC quirks yet decode fine.
    if (points.length === 0) throw errors[0]!;
  }

  points.sort((a, b) => a.time - b.time);
  events.sort((a, b) => a.time - b.time);

  const pauses: PauseSegment[] = detectPauses(points, events);

  const session = messages.sessionMesgs?.[0] as
    | Record<string, unknown>
    | undefined;
  const firstPoint = points[0];

  const lapMesgs = (messages.lapMesgs ?? []) as Record<string, unknown>[];
  const laps: Lap[] = lapMesgs.map((m, index) => ({
    index,
    startTime: dateMs(m.startTime),
    endTime: dateMs(m.timestamp),
    distanceMeters: num(m.totalDistance),
    timerSeconds: num(m.totalTimerTime),
  }));

  const activity: ParsedActivity = {
    summary: {
      sport: (session?.sport as string | undefined) ?? null,
      subSport: (session?.subSport as string | undefined) ?? null,
      startTime: firstPoint?.time ?? null,
      totalDistanceMeters: num(session?.totalDistance),
      totalTimerSeconds: num(session?.totalTimerTime),
      pointCount: points.length,
      pauseCount: pauses.length,
      lapCount: laps.length,
    },
    points,
    pauses,
    events,
    laps,
  };

  return { raw, activity };
}
