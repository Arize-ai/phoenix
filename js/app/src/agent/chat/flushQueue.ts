/**
 * Runs fire-and-forget flushes one at a time.
 */
export type FlushQueue = {
  /** Queue a flush to run once the ones before it have settled. */
  enqueue: (run: () => Promise<unknown>) => void;
  /**
   * Whether any queued flush is still in flight.
   */
  hasPending: () => boolean;
};

export function createFlushQueue(): FlushQueue {
  let tail: Promise<unknown> = Promise.resolve();
  let pendingCount = 0;
  return {
    enqueue: (run) => {
      pendingCount += 1;
      const settle = () => {
        pendingCount -= 1;
      };
      tail = tail.then(run, run).then(settle, settle);
    },
    hasPending: () => pendingCount > 0,
  };
}
