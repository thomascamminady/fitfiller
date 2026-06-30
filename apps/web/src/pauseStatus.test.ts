import { describe, it, expect } from 'vitest';
import { pauseStatus, pauseHasGps, BREAK_THRESHOLD_METERS } from './pauseStatus';
import { makePause } from './test/fixtures';

describe('pauseStatus', () => {
  it('flags a large move while paused as an issue', () => {
    const p = makePause(0);
    p.straightLineMeters = 400;
    expect(pauseStatus(p, false)).toBe('issue');
  });

  it('treats a barely-moved pause as a real break', () => {
    const p = makePause(0);
    p.straightLineMeters = BREAK_THRESHOLD_METERS - 1;
    expect(pauseStatus(p, false)).toBe('break');
  });

  it('reports fixed once a fill is enabled, regardless of distance', () => {
    const p = makePause(0);
    p.straightLineMeters = 400;
    expect(pauseStatus(p, true)).toBe('fixed');
  });

  it('reports nogps when an endpoint has no fix', () => {
    const p = makePause(0, false);
    expect(pauseHasGps(p)).toBe(false);
    expect(pauseStatus(p, false)).toBe('nogps');
  });
});
