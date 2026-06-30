// Lightweight mirror of the API/core DTOs. Kept local so the browser bundle
// never pulls in the FIT SDK; the shapes match @fitfiller/core's domain model.

export interface GeoPoint {
  lat: number;
  lon: number;
}

export interface TrackPoint {
  time: number;
  lat: number | null;
  lon: number | null;
  altitude: number | null;
  distance: number | null;
  speed: number | null;
  heartRate: number | null;
  cadence: number | null;
}

export interface PauseSegment {
  id: string;
  index: number;
  stopTime: number;
  startTime: number;
  pausedSeconds: number;
  before: TrackPoint;
  after: TrackPoint;
  straightLineMeters: number;
}

export interface Lap {
  index: number;
  startTime: number | null;
  endTime: number | null;
  distanceMeters: number | null;
  timerSeconds: number | null;
}

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

export interface ParsedActivity {
  summary: ActivitySummary;
  points: TrackPoint[];
  pauses: PauseSegment[];
  events: { time: number; type: string }[];
  laps: Lap[];
}

export interface UploadResponse {
  id: string;
  filename: string;
  activity: ParsedActivity;
}

export type FillMode = 'none' | 'average' | 'value';

export interface GapFillConfig {
  actualBreakSeconds: number;
  sampleSeconds?: number;
  heartRate?: { mode: FillMode; value?: number };
  cadence?: { mode: FillMode; value?: number };
  elevation?: { mode: 'linear' | 'route' };
  gradeAdjust?: boolean;
  snapToPath?: boolean;
}

export interface FillRequest {
  pauseId: string;
  route: GeoPoint[];
  config: GapFillConfig;
}

export interface GapFill {
  pauseId: string;
  records: TrackPoint[];
  addedDistanceMeters: number;
  movingSeconds: number;
  stopTime: number;
  startTime: number;
  dropTimerEvents: boolean;
}

export interface AuthContext {
  userId: string | null;
  isPremium: boolean;
  tier: 'anonymous' | 'free' | 'premium';
}

export interface ActivityStats {
  points: number;
  distanceMeters: number | null;
  durationSeconds: number | null;
  pauses: number;
  filledHeartRatePoints: number;
}

export interface ExportSummary {
  ok: boolean;
  original: ActivityStats;
  filled: ActivityStats;
  delta: {
    points: number;
    distanceMeters: number;
    durationSeconds: number;
    pausesRemoved: number;
  };
}
