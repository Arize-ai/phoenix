export function calculateAnnotationScorePercentile(
  value: number,
  min?: number | null,
  max?: number | null
): number {
  // Assume a 0 to 1 range if min and max are not provided
  const correctedMin = typeof min === "number" ? min : 0;
  const correctedMax = typeof max === "number" ? max : 1;

  if (correctedMin === correctedMax && correctedMax === value) {
    // All the values are the same, so we want to display it as full rather than empty
    return 100;
  }

  // Avoid division by zero
  const range = correctedMax - correctedMin || 1;
  return ((value - correctedMin) / range) * 100;
}
