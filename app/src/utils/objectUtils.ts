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
