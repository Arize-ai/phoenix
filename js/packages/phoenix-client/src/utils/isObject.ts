/**
 * A type guard for checking if a value is an object
 */
export function isObject(value: unknown): value is object {
  return typeof value === "object" && value !== null;
}
