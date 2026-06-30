// Display formatters. The app speaks in the athlete's units: km, pace, bpm.

export function fmtDistance(meters: number | null): string {
  if (meters === null) return '—';
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(2)} km`;
}

export function fmtDuration(seconds: number | null): string {
  if (seconds === null) return '—';
  const s = Math.round(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0)
    return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

/** Pace from speed (m/s) as min/km. */
export function fmtPace(metersPerSecond: number | null): string {
  if (!metersPerSecond || metersPerSecond <= 0) return '—';
  const secPerKm = 1000 / metersPerSecond;
  const m = Math.floor(secPerKm / 60);
  const s = Math.round(secPerKm % 60);
  return `${m}:${String(s).padStart(2, '0')} /km`;
}

export function fmtSport(sport: string | null): string {
  if (!sport) return 'Activity';
  return sport.charAt(0).toUpperCase() + sport.slice(1);
}
