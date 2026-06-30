import type { PauseSegment } from './types';

/**
 * Every detected pause falls into one of these states. The whole UI — the
 * ribbon, the map dots, the chart bands, the card — is colour-coded by it so
 * the user can tell at a glance what (if anything) needs their attention.
 */
export type PauseStatus = 'break' | 'issue' | 'fixed' | 'nogps';

/** Below this straight-line distance a pause reads as genuine standing-still. */
export const BREAK_THRESHOLD_METERS = 25;

export function pauseHasGps(p: PauseSegment): boolean {
  return (
    p.before.lat !== null &&
    p.before.lon !== null &&
    p.after.lat !== null &&
    p.after.lon !== null
  );
}

/**
 * Classify a pause.
 *  - `fixed`  — the user enabled a rebuild for this gap (green, resolved).
 *  - `nogps`  — can't be traced, no GPS on one side.
 *  - `break`  — barely moved; almost certainly a real rest (calm, low priority).
 *  - `issue`  — moved a meaningful distance while "paused" → the watch missed
 *               real ground and this should be repaired (warning).
 */
export function pauseStatus(
  pause: PauseSegment,
  enabled: boolean,
): PauseStatus {
  if (enabled) return 'fixed';
  if (!pauseHasGps(pause)) return 'nogps';
  if (pause.straightLineMeters < BREAK_THRESHOLD_METERS) return 'break';
  return 'issue';
}

interface StatusMeta {
  /** CSS class suffix → `.status-<tone>` / `.tone-<tone>`. */
  tone: PauseStatus;
  /** Hex used where styling can't reach (MapLibre paint, SVG fills). */
  color: string;
  short: string;
}

export const STATUS_META: Record<PauseStatus, StatusMeta> = {
  break: { tone: 'break', color: '#7c8b9a', short: 'Likely a real break' },
  issue: { tone: 'issue', color: '#e8642c', short: 'Needs a fix' },
  fixed: { tone: 'fixed', color: '#1f6f4a', short: 'Filling this gap' },
  nogps: { tone: 'nogps', color: '#a9b4ac', short: 'No GPS to trace' },
};
