/**
 * Framework-agnostic domain model for fitfiller.
 *
 * These types are the contract between the FIT parsing layer, the gap-filling
 * logic and the API/UI. They deliberately avoid any dependency on the Garmin
 * SDK message shapes so the rest of the app never has to know about FIT
 * internals (semicircles, scaled fields, enum strings, ...).
 */

/** A WGS84 coordinate in decimal degrees. */
export interface GeoPoint {
  lat: number;
  lon: number;
}

/** A single decoded `record` message, normalised to friendly units. */
export interface TrackPoint {
  /** Wall-clock time, epoch milliseconds. */
  time: number;
  /** Latitude in decimal degrees, if the record had a position. */
  lat: number | null;
  /** Longitude in decimal degrees, if the record had a position. */
  lon: number | null;
  /** Altitude in metres. */
  altitude: number | null;
  /** Cumulative distance in metres. */
  distance: number | null;
  /** Instantaneous speed in metres/second. */
  speed: number | null;
  /** Heart rate in beats/minute. */
  heartRate: number | null;
  /** Cadence (rpm or spm depending on sport). */
  cadence: number | null;
}

/** Timer start/stop event derived from `event` messages. */
export interface TimerEvent {
  time: number;
  /** `"start"` resumes the timer, `"stop"` / `"stopAll"` pauses it. */
  type: 'start' | 'stop' | 'stopAll' | string;
}

/**
 * A gap in the activity where the watch timer was paused. Produced by
 * {@link detectPauses}. Each segment is bounded by the last point recorded
 * before the pause and the first point recorded after resuming.
 */
export interface PauseSegment {
  id: string;
  /** Position of this pause in chronological order (0-based). */
  index: number;
  /** Epoch ms when the timer stopped. */
  stopTime: number;
  /** Epoch ms when the timer resumed. */
  startTime: number;
  /** Wall-clock duration of the pause in seconds. */
  pausedSeconds: number;
  /** Last recorded point before the pause (where the gap starts). */
  before: TrackPoint;
  /** First recorded point after resuming (where the gap ends). */
  after: TrackPoint;
  /** Straight-line distance between {@link before} and {@link after} in metres. */
  straightLineMeters: number;
}

/** A `lap` message, normalised to friendly units. */
export interface Lap {
  index: number;
  /** Epoch ms when the lap started. */
  startTime: number | null;
  /** Epoch ms when the lap ended. */
  endTime: number | null;
  distanceMeters: number | null;
  timerSeconds: number | null;
}

/** High-level summary of a decoded activity. */
export interface ActivitySummary {
  sport: string | null;
  subSport: string | null;
  startTime: number | null;
  totalDistanceMeters: number | null;
  totalTimerSeconds: number | null;
  pointCount: number;
  pauseCount: number;
  lapCount: number;
}

/** The parsed result handed to the rest of the application. */
export interface ParsedActivity {
  summary: ActivitySummary;
  points: TrackPoint[];
  pauses: PauseSegment[];
  events: TimerEvent[];
  laps: Lap[];
}
