import { useTimeRange } from "./TimeRangeContext";
import { isLastNTimeRangeKey } from "./utils";

/**
 * The time range as the user picked it: a live preset's key, which stays the
 * same while its window slides forward, or a custom range's bounds. As a
 * Suspense boundary's key, it shows the boundary's skeleton when the user
 * picks another range, and keeps the data up while a live range refreshes.
 */
export function useTimeRangeSelectionKey(): string {
  const { timeRange, timeRangeISOStrings } = useTimeRange();
  return isLastNTimeRangeKey(timeRange.timeRangeKey)
    ? timeRange.timeRangeKey
    : `${timeRangeISOStrings.start}/${timeRangeISOStrings.end}`;
}
