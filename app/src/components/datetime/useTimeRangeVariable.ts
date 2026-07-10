import { useMemo } from "react";

/**
 * The GraphQL `TimeRange` input variable shape: ISO-8601 string bounds, each
 * optional so an open-ended (live) window can leave a side unbounded.
 */
export type TimeRangeVariable = {
  start: string | undefined;
  end: string | undefined;
};

/**
 * Derive the GraphQL `TimeRange` input variable from an open time range,
 * memoized so the returned object keeps a stable identity across renders until
 * the window's bounds actually change.
 *
 * The stable identity matters when the variable is used as a `refetch`
 * dependency: unrelated re-renders (e.g. streamed data landing in the table)
 * must not produce a new object and trigger a redundant refetch. Conversely, a
 * live "last-N" window slides forward on a timer, changing `start` (and thus
 * this variable) — which is exactly when the table should refetch, carrying any
 * applied filter along so filtered results survive live streaming refreshes
 * (see issue #14216).
 */
export function useTimeRangeVariable(
  timeRange: OpenTimeRange
): TimeRangeVariable {
  const start = timeRange.start?.toISOString();
  const end = timeRange.end?.toISOString();
  return useMemo(() => ({ start, end }), [start, end]);
}
