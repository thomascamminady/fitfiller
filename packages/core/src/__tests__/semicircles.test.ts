import { describe, it, expect } from 'vitest';
import {
  degreesToSemicircles,
  semicirclesToDegrees,
} from '../fit/semicircles.js';

describe('semicircles', () => {
  it('maps 0° to 0 semicircles', () => {
    expect(degreesToSemicircles(0)).toBe(0);
    expect(semicirclesToDegrees(0)).toBe(0);
  });

  it('maps 180° to 2^31 semicircles', () => {
    expect(degreesToSemicircles(180)).toBe(2 ** 31);
  });

  it('round-trips a coordinate to within ~1e-5°', () => {
    for (const deg of [47.9959, -122.4194, 8.5417, -0.1276, 0.0001]) {
      const back = semicirclesToDegrees(degreesToSemicircles(deg));
      expect(back).toBeCloseTo(deg, 5);
    }
  });

  it('handles negative longitudes symmetrically', () => {
    expect(degreesToSemicircles(-90)).toBe(-degreesToSemicircles(90));
  });
});
