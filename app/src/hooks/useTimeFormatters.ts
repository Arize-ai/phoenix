import { useMemo } from "react";

import { usePreferencesContext } from "@phoenix/contexts";
import {
  getFullTimeFormatter,
  getShortDateTimeFormatter,
  getShortTimeFormatter,
} from "@phoenix/utils/timeFormatUtils";

/**
 * Hook that returns time formatters based on the user's timezone preference
 */
export function useTimeFormatters() {
  const displayTimezone = usePreferencesContext(
    (state) => state.displayTimezone
  );

  return useMemo(
    () => ({
      fullTimeFormatter: getFullTimeFormatter(displayTimezone),
      shortTimeFormatter: getShortTimeFormatter(displayTimezone),
      shortDateTimeFormatter: getShortDateTimeFormatter(displayTimezone),
      displayTimezone,
    }),
    [displayTimezone]
  );
}
