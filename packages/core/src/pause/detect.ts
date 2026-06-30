import type { TrackPoint, TimerEvent, PauseSegment } from '../domain/types.js';
import { haversineMeters } from '../geo/distance.js';

export interface DetectPausesOptions {
  /**
   * When no timer events bracket a gap, treat a jump larger than this many
   * seconds between consecutive records as a pause (covers auto-pause and
   * watches that don't emit explicit timer events). Default: 7s.
   */
  minGapSeconds?: number;
}

const isStop = (t: string): boolean =>
  t === 'stop' || t === 'stopAll' || t === 'stopDisableAll';

function lastPointBefore(
  points: TrackPoint[],
  time: number,
): TrackPoint | null {
  let found: TrackPoint | null = null;
  for (const p of points) {
    if (p.time <= time) found = p;
    else break;
  }
  return found;
}

function firstPointAfter(
  points: TrackPoint[],
  time: number,
): TrackPoint | null {
  for (const p of points) {
    if (p.time >= time) return p;
  }
  return null;
}

function straightLine(a: TrackPoint, b: TrackPoint): number {
  if (a.lat === null || a.lon === null || b.lat === null || b.lon === null) {
    return 0;
  }
  return haversineMeters(
    { lat: a.lat, lon: a.lon },
    { lat: b.lat, lon: b.lon },
  );
}

function makeSegment(
  before: TrackPoint,
  after: TrackPoint,
  stopTime: number,
  startTime: number,
): Omit<PauseSegment, 'id' | 'index'> {
  return {
    stopTime,
    startTime,
    pausedSeconds: Math.max(0, (startTime - stopTime) / 1000),
    before,
    after,
    straightLineMeters: straightLine(before, after),
  };
}

/**
 * Identify paused segments in an activity.
 *
 * Primary signal is timer `stop` -> `start` event pairs. As a fallback we also
 * flag large time gaps between consecutive records that aren't already covered
 * by an event pair (catches auto-pause without explicit events).
 *
 * `points` and `events` are expected to be sorted ascending by time.
 */
export function detectPauses(
  points: TrackPoint[],
  events: TimerEvent[],
  options: DetectPausesOptions = {},
): PauseSegment[] {
  const minGapMs = (options.minGapSeconds ?? 7) * 1000;
  const segments: Omit<PauseSegment, 'id' | 'index'>[] = [];

  // 1) Event-driven pauses.
  let stopTime: number | null = null;
  for (const ev of events) {
    if (isStop(ev.type)) {
      if (stopTime === null) stopTime = ev.time;
    } else if (ev.type === 'start') {
      if (stopTime !== null && ev.time > stopTime) {
        const before = lastPointBefore(points, stopTime);
        const after = firstPointAfter(points, ev.time);
        if (before && after && after.time > before.time) {
          segments.push(makeSegment(before, after, stopTime, ev.time));
        }
      }
      stopTime = null;
    }
  }

  // 2) Time-gap fallback for gaps not already represented by an event pair.
  const covered = (a: number, b: number): boolean =>
    segments.some((s) => a < s.startTime && b > s.stopTime);
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1]!;
    const cur = points[i]!;
    const gap = cur.time - prev.time;
    if (gap >= minGapMs && !covered(prev.time, cur.time)) {
      segments.push(makeSegment(prev, cur, prev.time, cur.time));
    }
  }

  segments.sort((a, b) => a.stopTime - b.stopTime);
  return segments.map((s, index) => ({
    ...s,
    index,
    id: `pause-${index}`,
  }));
}
