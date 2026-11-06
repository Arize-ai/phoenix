const countFormatter = new Intl.NumberFormat();

/** Queue counts from the server stop at this many. */
export const MAX_QUEUE_COUNT = 1_000_000;

/** A queue count, shown as "1,000,000+" once it reaches the server's limit. */
export function formatQueueCount(count: number): string {
  return count >= MAX_QUEUE_COUNT
    ? `${countFormatter.format(MAX_QUEUE_COUNT)}+`
    : countFormatter.format(count);
}

/** Queued evaluations that clearing removes: running ones finish. */
export function getClearableCount(
  counts: { queuedCount: number; runningCount: number } | null | undefined
): number {
  if (counts == null) {
    return 0;
  }
  return counts.queuedCount >= MAX_QUEUE_COUNT
    ? MAX_QUEUE_COUNT
    : counts.queuedCount - counts.runningCount;
}
