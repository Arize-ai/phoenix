import { useMemo } from "react";
import { timeFormat } from "d3-time-format";

import {
  ONE_DAY_IN_MINUTES,
  ONE_HOUR_IN_MINUTES,
} from "@phoenix/utils/timeSeriesUtils";

type TimeFormatterConfig = {
  /**
   * The sampling interval in minutes. E.g. the time between the dots on the chart
   */
  samplingIntervalMinutes: number;
};

export function getFormatFromSamplingInterval(
  samplingIntervalMinutes: number
): string {
  let format: string;
  if (samplingIntervalMinutes < ONE_HOUR_IN_MINUTES) {
    // Remove the year, and show minutes
    format = "%H:%M %p";
  } else if (samplingIntervalMinutes < ONE_DAY_IN_MINUTES) {
    // Show a fill date
    format = "%x %H:%M %p";
  } else {
    // Just show the year and date
    format = "%x";
  }
  return format;
}

/**
 * A react hook that returns a time formatter for time series charts
 * @param {TimeFormatterConfig} config
 * @returns
 */
export function useTimeTickFormatter(config: TimeFormatterConfig) {
  const samplingIntervalMinutes = config.samplingIntervalMinutes;
  const formatter = useMemo(() => {
    return timeFormat(getFormatFromSamplingInterval(samplingIntervalMinutes));
  }, [samplingIntervalMinutes]);
  return formatter;
}
