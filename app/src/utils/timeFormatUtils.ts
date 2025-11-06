import { formatInTimeZone, FormatOptionsWithTZ } from "date-fns-tz";

import { getTimeZone } from "@phoenix/utils/timeUtils";

/**
 * Creates a time formatter from a pattern
 * NB: this is intentionally made strict to Date for safety
 * @param pattern - The pattern to use for the formatter
 * @returns A time formatter
 */
export type TimeFormatter = (
  date: Date,
  formatOptions?: FormatOptionsWithTZ
) => string;

export function createTimeFormatter(
  pattern: string,
  timeZone: string
): TimeFormatter {
  return (date: Date) => {
    return formatInTimeZone(date, timeZone, pattern);
  };
}

/**
 * Formats time to be displayed in full with date and time
 */
export const fullTimeFormatter = createTimeFormatter(
  "P HH:mm:ss a",
  getTimeZone()
);

/**
 * Formats time to be displayed in short (no year or date)
 */
export const shortTimeFormatter = createTimeFormatter("HH:mm a", getTimeZone());

/**
 * Formats time to be displayed in short with date and time
 */
export const shortDateTimeFormatter = createTimeFormatter(
  "P HH:mm a",
  getTimeZone()
);

/**
 * Formats a time range as a string
 * @param timeRange - The time range to format
 * @returns The formatted time range
 */
export const timeRangeFormatter = (timeRange: OpenTimeRange) => {
  if (timeRange.start && timeRange.end) {
    return `${fullTimeFormatter(timeRange.start)} - ${fullTimeFormatter(timeRange.end)}`;
  } else if (timeRange.start) {
    return `From ${fullTimeFormatter(timeRange.start)}`;
  } else if (timeRange.end) {
    return `Until ${fullTimeFormatter(timeRange.end)}`;
  } else {
    return "All Time";
  }
};

export function getLocaleDateFormatPattern(locale: string) {
  const formatParts = new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).formatToParts(new Date());

  const pattern = formatParts
    .map((part) => {
      switch (part.type) {
        case "day":
          return "dd";
        case "month":
          return "mm";
        case "year":
          return "yyyy";
        case "literal":
          return part.value;
        default:
          return "";
      }
    })
    .join("");

  return pattern;
}
