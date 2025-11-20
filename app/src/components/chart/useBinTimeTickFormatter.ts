import { useMemo } from "react";

import { usePreferencesContext } from "@phoenix/contexts";
import { assertUnreachable } from "@phoenix/typeUtils";
import { createTimeFormatter } from "@phoenix/utils/timeFormatUtils";
import { getLocale } from "@phoenix/utils/timeUtils";

/**
 * A react hook that returns a time formatter for time series charts
 * Notably it returns a formatter that is aware of the bin scale. E.g. if we are binning by day,
 * we want to show the date, but if we are binning by hour, we want to show the hours.
 */
export function useBinTimeTickFormatter({ scale }: { scale: TimeBinScale }) {
  const displayTimezone = usePreferencesContext(
    (state) => state.displayTimezone
  );
  return useMemo(() => {
    const locale = getLocale();
    switch (scale) {
      case "YEAR":
        return createTimeFormatter(locale, {
          year: "numeric",
          timeZone: displayTimezone,
        });
      case "MONTH":
        return createTimeFormatter(locale, {
          month: "short",
          year: "numeric",
          timeZone: displayTimezone,
        });
      case "WEEK":
      case "DAY":
        // Just show the month and date
        return createTimeFormatter(locale, {
          month: "numeric",
          day: "numeric",
          timeZone: displayTimezone,
        });
      case "HOUR":
        return createTimeFormatter(locale, {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
          timeZone: displayTimezone,
        });
      case "MINUTE":
        return createTimeFormatter(locale, {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
          timeZone: displayTimezone,
        });
      default: {
        assertUnreachable(scale);
      }
    }
  }, [scale, displayTimezone]);
}
