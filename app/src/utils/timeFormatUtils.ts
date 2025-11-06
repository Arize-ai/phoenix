import { getLocale } from "@phoenix/utils/timeUtils";

/**
 * Creates a time formatter from a pattern
 * NB: this is intentionally made strict to Date for safety
 * @param pattern - The pattern to use for the formatter
 * @returns A time formatter
 */
export type TimeFormatter = (date: Date) => string;

export function createTimeFormatter(
  locale: string,
  options: Intl.DateTimeFormatOptions
): TimeFormatter {
  const formatter = new Intl.DateTimeFormat(locale, {
    ...options,
  });
  return (date: Date) => {
    return formatter.format(date);
  };
}

/**
 * Formats time to be displayed in full with date and time
 * Equivalent to "P HH:mm:ss a" - full date with time including seconds
 */
export const fullTimeFormatter = createTimeFormatter(getLocale(), {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: true,
});

/**
 * Formats time to be displayed in short (no year or date)
 * Equivalent to "HH:mm a" - time only
 */
export const shortTimeFormatter = createTimeFormatter(getLocale(), {
  hour: "2-digit",
  minute: "2-digit",
  hour12: true,
});

/**
 * Formats time to be displayed in short with date and time
 * Equivalent to "P HH:mm a" - date with time (no seconds)
 */
export const shortDateTimeFormatter = createTimeFormatter(getLocale(), {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: true,
});

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
