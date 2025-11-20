import { useMemo } from "react";

import { usePreferencesContext } from "@phoenix/contexts";
import {
  createTimeFormatter,
  type TimeFormatter,
} from "@phoenix/utils/timeFormatUtils";
import {
  ONE_DAY_IN_MINUTES,
  ONE_HOUR_IN_MINUTES,
} from "@phoenix/utils/timeSeriesUtils";
import { getLocale } from "@phoenix/utils/timeUtils";

type TimeFormatterConfig = {
  /**
   * The sampling interval in minutes. E.g. the time between the dots on the chart
   */
  samplingIntervalMinutes: number;
  /**
   * The locale to use for the formatter
   * @default the browser's locale
   */
  locale?: string;
  /**
   * The timezone to use for the formatter
   * @default the user's timezone
   */
  timeZone?: string;
};
export function getFormatterFromSamplingInterval({
  samplingIntervalMinutes,
  locale = getLocale(),
  timeZone,
}: TimeFormatterConfig): TimeFormatter {
  if (samplingIntervalMinutes < ONE_HOUR_IN_MINUTES) {
    // Remove the year, and show minutes
    return createTimeFormatter(locale, {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
      timeZone,
    });
  } else if (samplingIntervalMinutes < ONE_DAY_IN_MINUTES) {
    // Show a full date with time
    return createTimeFormatter(locale, {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
      timeZone,
    });
  } else {
    // Just show the month and date
    return createTimeFormatter(locale, {
      month: "numeric",
      day: "numeric",
      timeZone,
    });
  }
}

/**
 * A react hook that returns a time formatter for time series charts
 * @param {TimeFormatterConfig} config
 * @returns
 */
export function useTimeTickFormatter({
  samplingIntervalMinutes,
  locale,
}: Omit<TimeFormatterConfig, "timeZone">) {
  const displayTimezone = usePreferencesContext(
    (state) => state.displayTimezone
  );
  const formatter = useMemo(() => {
    return getFormatterFromSamplingInterval({
      samplingIntervalMinutes,
      locale,
      timeZone: displayTimezone,
    });
  }, [samplingIntervalMinutes, locale, displayTimezone]);
  return formatter;
}
