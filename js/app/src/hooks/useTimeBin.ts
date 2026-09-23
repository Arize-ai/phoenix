import { useMemo } from "react";

import {
  ONE_DAY_SEC,
  ONE_HOUR_SEC,
  ONE_MONTH_SEC,
  ONE_WEEK_SEC,
  ONE_YEAR_SEC,
} from "@phoenix/constants/timeConstants";

/**
 * Given a time range, returns the appropriate time bin scale to use. Used for charting.
 */
export function useTimeBinScale({
  timeRange,
}: {
  timeRange: OpenTimeRange;
}): TimeBinScale {
  return useMemo(() => {
    const startTime = timeRange.start;
    let scale: TimeBinScale = "DAY"; // TODO: Does this make sense
    if (startTime) {
      const endTime = timeRange.end || new Date();
      const duration = (endTime.getTime() - startTime.getTime()) / 1000; // in seconds
      if (duration > 5 * ONE_YEAR_SEC) {
        scale = "YEAR";
      } else if (duration > 5 * ONE_MONTH_SEC) {
        scale = "MONTH";
      } else if (duration > 5 * ONE_WEEK_SEC) {
        scale = "WEEK";
      } else if (duration > 5 * ONE_DAY_SEC) {
        scale = "DAY";
      } else if (duration > 5 * ONE_HOUR_SEC) {
        scale = "HOUR";
      } else {
        scale = "MINUTE";
      }
    }
    return scale;
  }, [timeRange]);
}
