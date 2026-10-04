export function calculateAnnotationScorePercentile(
  value: number,
  min?: number | null,
  max?: number | null
): number {
  // Assume a 0 to 1 range if min and max are not provided
  const correctedMin = typeof min === "number" ? min : 0;
  const correctedMax = typeof max === "number" ? max : 1;

  if (correctedMin === correctedMax && correctedMax === value) {
    // All the values are the same
    // If the value is 0, show empty; if non-zero, show full
    return value === 0 ? 0 : 100;
  }

  // Avoid division by zero
  const range = correctedMax - correctedMin || 1;
  return ((value - correctedMin) / range) * 100;
}

/**
 * Formats the relative change of a compare experiment's value against the base
 * experiment's value, e.g. "+12.50%" or "-3.00%".
 *
 * Returns "--" when the change is undefined: either value is missing, or the
 * base value is 0 and the compare value is not (no percentage of 0 exists).
 * Showing "+0%" in those cases would read as "no change".
 */
export function formatPercentageDelta({
  value,
  baseValue,
  formatPercent,
}: {
  value: number | null | undefined;
  baseValue: number | null | undefined;
  formatPercent: (value: number) => string;
}): string {
  if (typeof value !== "number" || typeof baseValue !== "number") {
    return "--";
  }
  const delta = value - baseValue;
  if (baseValue === 0) {
    return delta === 0 ? `+${formatPercent(0)}` : "--";
  }
  const sign = delta >= 0 ? "+" : "-";
  return `${sign}${formatPercent(Math.abs(delta / baseValue) * 100)}`;
}
