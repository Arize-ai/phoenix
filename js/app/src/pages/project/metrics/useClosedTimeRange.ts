import { useMemo } from "react";

import { useTimeRange } from "@phoenix/components";
import { ONE_MONTH_MS } from "@phoenix/constants/timeConstants";

/**
 * Hook that converts an open time range from context into a closed time range.
 * If the time range is already closed, it returns it as-is.
 * If it's open, it fills in missing start/end values based on the stable
 * provider-owned "now" timestamp.
 */
export function useClosedTimeRange(): TimeRange {
  const { timeRange: contextTimeRange, timeRangeNow } = useTimeRange();

  const startMs = contextTimeRange.start?.getTime() ?? null;
  const endMs = contextTimeRange.end?.getTime() ?? null;

  return useMemo<TimeRange>(() => {
    if (startMs !== null && endMs !== null) {
      // closed range from context
      return { start: new Date(startMs), end: new Date(endMs) };
    } else if (startMs === null && endMs !== null) {
      return { start: new Date(endMs - ONE_MONTH_MS), end: new Date(endMs) };
    } else if (startMs !== null) {
      // If start is in the past, close at "now"; else, one month after start
      const closedEndMs =
        startMs < timeRangeNow ? timeRangeNow : startMs + ONE_MONTH_MS;
      return { start: new Date(startMs), end: new Date(closedEndMs) };
    } else {
      // both null → last month to now
      return {
        start: new Date(timeRangeNow - ONE_MONTH_MS),
        end: new Date(timeRangeNow),
      };
    }
  }, [startMs, endMs, timeRangeNow]);
}
