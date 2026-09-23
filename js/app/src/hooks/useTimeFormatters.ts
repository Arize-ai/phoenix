import { useMemo } from "react";

import { usePreferencesContext } from "@phoenix/contexts";
import {
  createFullTimeFormatter,
  createShortDateTimeFormatter,
  createShortTimeFormatter,
  createTimeRangeFormatter,
} from "@phoenix/utils/timeFormatUtils";
import { getLocale, getTimeZone } from "@phoenix/utils/timeUtils";

/**
 * Hook that returns time formatters based on the user's timezone preference
 */
export function useTimeFormatters() {
  const displayTimezone = usePreferencesContext(
    (state) => state.displayTimezone
  );

  return useMemo(() => {
    const timeZone = displayTimezone ?? getTimeZone();
    return {
      fullTimeFormatter: createFullTimeFormatter({
        locale: getLocale(),
        timeZone,
      }),
      shortTimeFormatter: createShortTimeFormatter({
        locale: getLocale(),
        timeZone,
      }),
      shortDateTimeFormatter: createShortDateTimeFormatter({
        locale: getLocale(),
        timeZone,
      }),
      timeRangeFormatter: createTimeRangeFormatter({
        locale: getLocale(),
        timeZone,
      }),
    };
  }, [displayTimezone]);
}
