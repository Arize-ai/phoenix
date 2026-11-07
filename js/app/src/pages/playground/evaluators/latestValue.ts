/**
 * A value that async code can await conditions on. React code publishes each
 * committed state with `set`; an operation that has just changed something
 * awaits the render that reflects it with `waitFor` instead of polling.
 */
export function createLatestValue<T>(initial: T) {
  let value = initial;
  const watchers = new Set<(next: T) => void>();

  return {
    get: () => value,
    set(next: T) {
      value = next;

      for (const notify of [...watchers]) notify(next);
    },
    /**
     * Resolves with the first value that satisfies `predicate`, the current
     * one included, or with null once `timeoutMs` passes without one.
     */
    waitFor(
      predicate: (value: T) => boolean,
      timeoutMs: number
    ): Promise<T | null> {
      if (predicate(value)) return Promise.resolve(value);

      return new Promise((resolve) => {
        const timer = setTimeout(() => {
          watchers.delete(check);
          resolve(null);
        }, timeoutMs);

        function check(next: T) {
          if (!predicate(next)) return;
          clearTimeout(timer);
          watchers.delete(check);
          resolve(next);
        }

        watchers.add(check);
      });
    },
  };
}
