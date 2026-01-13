import { isStringKeyedObject } from "@phoenix/typeUtils";

/**
 * Removes null, undefined, empty strings, empty objects, and empty arrays from an object.
 * Returns undefined if the resulting object would be empty.
 *
 * Used to build compact GraphQL mutation inputs that only include defined values.
 *
 * @returns A partial version of the input object with empty values removed,
 *          or undefined if all values were empty.
 *
 * @remarks
 * The return type is `Partial<T> | undefined` which provides better type safety
 * than `any` while still being compatible with GraphQL mutation inputs.
 * The GraphQL schema enforces required fields at the server layer, and
 * Zod validation ensures required fields are present before submission.
 */
export function compressObject<T extends Record<string, unknown>>(
  obj: T
): Partial<T> | undefined {
  const entries = Object.entries(obj).filter(([, value]) => {
    if (value === null || value === undefined) return false;
    if (value === "") return false;
    if (typeof value === "object" && !Array.isArray(value)) {
      return Object.keys(value).length > 0;
    }
    if (Array.isArray(value)) return value.length > 0;
    return true;
  });

  if (entries.length === 0) return undefined;

  return Object.fromEntries(entries) as Partial<T>;
}

/**
 * Get a value from an object using a dot-notation path.
 *
 * TODO: Replace this with a JSON path-based utility (e.g., using jsonpath-plus
 * or similar library) to support full JSON path syntax like:
 * - $.input.query
 * - $.metadata.tags[0]
 * - $..nested.field
 *
 * @param obj - The object to retrieve the value from
 * @param path - Dot-notation path (e.g., "input", "input.query")
 * @returns The value at the path, or undefined if not found
 */
export function getValueAtPath(obj: unknown, path: string): unknown {
  if (!path || !isStringKeyedObject(obj)) {
    return obj;
  }

  const segments = path.split(".");
  let current: unknown = obj;

  for (const segment of segments) {
    if (!isStringKeyedObject(current)) {
      return undefined;
    }
    current = current[segment];
  }

  return current;
}
