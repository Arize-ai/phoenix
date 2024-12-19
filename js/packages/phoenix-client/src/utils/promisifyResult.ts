/**
 * If the incoming function returns a promise, return the promise.
 * Otherwise, return a promise that resolves to the incoming function's return value.
 */
export function promisifyResult<T>(result: T) {
  if (result instanceof Promise) {
    return result as T extends Promise<infer U> ? Promise<U> : never;
  }

  return Promise.resolve(result) as T extends Promise<unknown>
    ? never
    : Promise<T>;
}
