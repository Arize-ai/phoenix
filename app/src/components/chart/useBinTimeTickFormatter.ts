import { useMemo } from "react";
import { timeFormat } from "d3-time-format";

import { assertUnreachable } from "@phoenix/typeUtils";

/**
 * A react hook that returns a time formatter for time series charts
 * Notably it returns a formatter that is aware of the bin scale. E.g. if we are binning by day,
 * we want to show the date, but if we are binning by hour, we want to show the hours.
 */
export function useBinTimeTickFormatter({ scale }: { scale: TimeBinScale }) {
  return useMemo(() => {
    switch (scale) {
      case "YEAR":
        return timeFormat("%Y");
      case "MONTH":
        return timeFormat("%b %Y");
      case "WEEK":
      case "DAY":
        // Just show the month and date
        return timeFormat("%-m/%-d");
      case "HOUR":
        return timeFormat("%H:%M");
      case "MINUTE":
        return timeFormat("%H:%M");
      default: {
        assertUnreachable(scale);
      }
    }
  }, [scale]);
}
