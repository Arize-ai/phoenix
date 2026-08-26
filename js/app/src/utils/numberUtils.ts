/**
 * Clamp a number to an inclusive range.
 * @param params - clamp parameters
 * @param params.value - number to constrain
 * @param params.min - inclusive lower bound
 * @param params.max - inclusive upper bound
 */
export function clampNumber({
  value,
  min,
  max,
}: {
  value: number;
  min: number;
  max: number;
}): number {
  return Math.min(Math.max(value, min), max);
}
