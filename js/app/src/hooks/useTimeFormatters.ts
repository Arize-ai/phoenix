import { useMemo } from "react";

import { usePreferencesContext } from "@phoenix/contexts";
import {
  createFullTimeFormatter,
  createShortDateFormatter,
  createShortDateTimeFormatter,
  createShortTimeFormatter,
  createTimeRangeFormatter,
} from "@phoenix/utils/timeFormatUtils";
import { getLocale, getTimeZone } from "@phoenix/utils/timeUtils";

/**
 * Constructing an Intl.DateTimeFormat is comparatively expensive and most
 * consumers (e.g. a table cell) use only one of the formatters, so each is
 * built on first use rather than eagerly.
 */
function lazily<Arg, Result>(
  create: () => (arg: Arg) => Result
): (arg: Arg) => Result {
  let format: ((arg: Arg) => Result) | undefined;
  return (arg) => (format ??= create())(arg);
}

/**
 * Hook that returns time formatters based on the user's timezone preference
 */
export function useTimeFormatters() {
  const displayTimezone = usePreferencesContext(
    (state) => state.displayTimezone
  );

  return useMemo(() => {
    const displayOptions = {
      locale: getLocale(),
      timeZone: displayTimezone ?? getTimeZone(),
    };
    return {
      fullTimeFormatter: lazily(() => createFullTimeFormatter(displayOptions)),
      shortTimeFormatter: lazily(() =>
        createShortTimeFormatter(displayOptions)
      ),
      shortDateTimeFormatter: lazily(() =>
        createShortDateTimeFormatter(displayOptions)
      ),
      shortDateFormatter: lazily(() =>
        createShortDateFormatter(displayOptions)
      ),
      timeRangeFormatter: lazily(() =>
        createTimeRangeFormatter(displayOptions)
      ),
    };
  }, [displayTimezone]);
}
