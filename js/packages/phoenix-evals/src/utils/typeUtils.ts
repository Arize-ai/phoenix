/**
 * Type guard for if a function is a Promise
 * @param value
 * @returns true if it is a Promise
 */
export function isPromise<T = unknown>(value: unknown): value is Promise<T> {
  return (
    !!value &&
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    typeof (value as any)?.then === "function" &&
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    typeof (value as any)?.catch === "function"
  );
}
