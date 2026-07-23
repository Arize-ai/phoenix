/**
 * Type guard for if a function is a Promise
 * @param value
 * @returns true if it is a Promise
 */
export function isPromise<T = unknown>(value: unknown): value is Promise<T> {
  if (
    value === null ||
    (typeof value !== "object" && typeof value !== "function")
  ) {
    return false;
  }
  return (
    "then" in value &&
    typeof value.then === "function" &&
    "catch" in value &&
    typeof value.catch === "function"
  );
}
