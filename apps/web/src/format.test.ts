import { describe, it, expect } from 'vitest';
import { fmtDistance, fmtDuration, fmtPace, fmtSport } from './format';

describe('fmtDistance', () => {
  it('shows metres below 1 km', () => {
    expect(fmtDistance(450)).toBe('450 m');
    expect(fmtDistance(0)).toBe('0 m');
  });
  it('shows kilometres above 1 km', () => {
    expect(fmtDistance(2116.4)).toBe('2.12 km');
  });
  it('handles null', () => {
    expect(fmtDistance(null)).toBe('—');
  });
});

describe('fmtDuration', () => {
  it('formats minutes:seconds', () => {
    expect(fmtDuration(0)).toBe('0:00');
    expect(fmtDuration(65)).toBe('1:05');
  });
  it('formats hours:minutes:seconds', () => {
    expect(fmtDuration(3661)).toBe('1:01:01');
  });
  it('handles null', () => {
    expect(fmtDuration(null)).toBe('—');
  });
});

describe('fmtPace', () => {
  it('converts m/s to min/km', () => {
    // 3.333 m/s -> 5:00 /km
    expect(fmtPace(1000 / 300)).toBe('5:00 /km');
  });
  it('handles zero / null speed', () => {
    expect(fmtPace(0)).toBe('—');
    expect(fmtPace(null)).toBe('—');
  });
});

describe('fmtSport', () => {
  it('capitalises a sport', () => {
    expect(fmtSport('running')).toBe('Running');
  });
  it('falls back to Activity', () => {
    expect(fmtSport(null)).toBe('Activity');
  });
});
