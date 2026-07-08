/**
 * If the incoming function returns a promise, return the promise.
 * Otherwise, return a promise that resolves to the incoming function's return value.
 */
export function promisifyResult<Result>(result: Result) {
  if (result instanceof Promise) {
    return result as Result extends Promise<infer ResolvedValue>
      ? Promise<ResolvedValue>
      : never;
  }

  return Promise.resolve(result) as Result extends Promise<unknown>
    ? never
    : Promise<Result>;
}
