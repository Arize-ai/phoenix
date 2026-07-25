/**
 * Helpers shared by the examples in this directory.
 *
 * Dataset example inputs, expected values, and task outputs are untyped JSON --
 * the client types them as `unknown` or `Record<string, unknown>` because their
 * shape is defined by your dataset, not by Phoenix. These helpers read a field
 * off such a value without asserting a type onto it, so the examples show a
 * pattern worth copying rather than a cast that happens to compile.
 */

/**
 * Narrows an untyped JSON value to a string-keyed record.
 *
 * This is a type predicate rather than a cast, so the narrowing is tied to the
 * runtime check. Arrays satisfy it, matching how `JSON.parse` output is treated
 * throughout these examples; every field still reads back as `unknown`.
 */
export function isJsonRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * Reads a single field off an untyped JSON value.
 *
 * Returns `undefined` when the value is not an object or has no such field.
 */
export function readField(value: unknown, key: string): unknown {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }
  return Object.entries(value).find(([k]) => k === key)?.[1];
}

/**
 * Reads a string field off an untyped JSON value.
 *
 * Returns `undefined` when the value is not an object, has no such field, or
 * the field is not a string -- so callers can supply their own fallback.
 */
export function readStringField(
  value: unknown,
  key: string
): string | undefined {
  const field = readField(value, key);
  return typeof field === "string" ? field : undefined;
}
