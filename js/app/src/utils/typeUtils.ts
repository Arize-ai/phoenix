/**
 * Narrows an unknown value to a keyed record so its properties can be safely
 * probed. Note: arrays and other non-plain objects also pass this guard; use
 * a stricter check if arrays must be excluded.
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
