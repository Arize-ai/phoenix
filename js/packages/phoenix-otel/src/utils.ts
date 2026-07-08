import type { AttributeValue } from "@opentelemetry/api";

/**
 * Converts a plain object into an OpenTelemetry-compatible attributes record
 * by filtering out `null` values. Properties with `null` values are removed
 * because OpenTelemetry attributes do not support `null`.
 *
 * Note: `undefined` values are not filtered and will pass through.
 *
 * @param obj - The source object whose entries will be converted to attributes.
 * @returns A new record containing only the non-null entries from the input.
 */
export function objectAsAttributes<T extends Record<string, unknown>>(
  obj: T
): Record<string, AttributeValue> {
  return Object.fromEntries(
    Object.entries(obj).filter(([_, value]) => value !== null)
  ) as Record<string, AttributeValue>;
}
