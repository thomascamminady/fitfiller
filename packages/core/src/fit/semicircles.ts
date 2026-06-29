/**
 * FIT stores positions as 32-bit "semicircles". These helpers convert between
 * semicircles and decimal degrees.
 */

const SEMICIRCLES_PER_DEGREE = 2 ** 31 / 180;

export function semicirclesToDegrees(semicircles: number): number {
  return semicircles / SEMICIRCLES_PER_DEGREE;
}

export function degreesToSemicircles(degrees: number): number {
  return Math.round(degrees * SEMICIRCLES_PER_DEGREE);
}
