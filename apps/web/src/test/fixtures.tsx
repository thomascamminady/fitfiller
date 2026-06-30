import type { ParsedActivity, PauseSegment, TrackPoint } from '../types';
import type { PauseFillState } from '../components/PauseInspector';

const T0 = 1_000_000_000_000;

function pt(over: Partial<TrackPoint>): TrackPoint {
  return {
    time: T0,
    lat: 47,
    lon: 8,
    altitude: 100,
    distance: 100,
    speed: 3,
    heartRate: 150,
    cadence: 85,
    ...over,
  };
}

export function makePause(i: number, hasGps = true): PauseSegment {
  return {
    id: `pause-${i}`,
    index: i,
    stopTime: T0 + i * 1000,
    startTime: T0 + i * 1000 + 60_000,
    pausedSeconds: 60,
    before: pt({ lat: hasGps ? 47 : null, lon: hasGps ? 8 : null }),
    after: pt({ lat: hasGps ? 47.01 : null, lon: hasGps ? 8.01 : null }),
    straightLineMeters: 450,
  };
}

export function makeActivity(pauseCount = 2): ParsedActivity {
  const pauses = Array.from({ length: pauseCount }, (_, i) => makePause(i));
  return {
    summary: {
      sport: 'running',
      subSport: null,
      startTime: T0,
      totalDistanceMeters: 5000,
      totalTimerSeconds: 1500,
      pointCount: 1500,
      pauseCount,
      lapCount: 2,
    },
    points: [pt({}), pt({ lon: 8.01 })],
    pauses,
    events: [],
    laps: [
      {
        index: 0,
        startTime: T0,
        endTime: T0 + 60_000,
        distanceMeters: 1000,
        timerSeconds: 300,
      },
      {
        index: 1,
        startTime: T0 + 60_000,
        endTime: T0 + 120_000,
        distanceMeters: 1000,
        timerSeconds: 300,
      },
    ],
  };
}

export function defaultFill(): PauseFillState {
  return {
    enabled: false,
    waypoints: [],
    actualBreakSeconds: 0,
    heartRate: 'average',
    heartRateValue: 150,
    cadence: 'average',
    cadenceValue: 85,
    elevation: 'linear',
    gradeAdjust: false,
    preview: null,
    previewError: null,
  };
}

export function makeFills(
  activity: ParsedActivity,
): Record<string, PauseFillState> {
  return Object.fromEntries(activity.pauses.map((p) => [p.id, defaultFill()]));
}
