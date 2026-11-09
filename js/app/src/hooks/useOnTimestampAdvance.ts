import { useEffect, useEffectEvent, useRef } from "react";

/**
 * Calls `onAdvance` each time a timestamp moves later than any value seen
 * before. Use it with a polled "last updated" value to act only when the
 * data behind it has changed, rather than on every poll.
 *
 * - The value on the first render is the baseline. It never triggers a call,
 *   because the caller's data was loaded against it.
 * - A null baseline means nothing has been recorded yet, so the first
 *   non-null value counts as an advance.
 * - An equal, earlier, or null value is ignored, and so is a value already
 *   reported.
 *
 * `onAdvance` always sees the latest render, so callers can pass an inline
 * closure without memoizing it. It runs in an effect, outside any
 * transition. Wrap the work in `startTransition` yourself when it would
 * otherwise suspend visible content.
 *
 * @param timestamp - ISO 8601 timestamp in UTC. Values in one format compare
 * by their string order, so they must all come from the same source.
 * @param onAdvance - called with the new timestamp
 *
 * @example
 * ```tsx
 * useOnTimestampAdvance(project.streamingLastUpdatedAt, (lastUpdatedAt) => {
 *   startTransition(() => setFetchKey(lastUpdatedAt));
 * });
 * ```
 */
export function useOnTimestampAdvance(
  timestamp: string | null,
  onAdvance: (timestamp: string) => void
) {
  const latestTimestampRef = useRef(timestamp);
  const onAdvanceEvent = useEffectEvent(onAdvance);
  useEffect(() => {
    const latestTimestamp = latestTimestampRef.current;
    if (
      timestamp != null &&
      (latestTimestamp == null || latestTimestamp < timestamp)
    ) {
      latestTimestampRef.current = timestamp;
      onAdvanceEvent(timestamp);
    }
  }, [timestamp]);
}
