/**
 * Normalizes a possibly-async value into a promise.
 *
 * `Promise.resolve` already covers both cases at runtime — handed a native
 * promise it returns that same promise, and handed a plain value it wraps it —
 * so no branching is needed. Typing the result as `Promise<Awaited<Result>>`
 * also avoids the `never` arms that a conditional return type would require,
 * which could not be narrowed from a runtime `instanceof` check anyway.
 */
export function promisifyResult<Result>(
  result: Result
): Promise<Awaited<Result>> {
  return Promise.resolve(result);
}
