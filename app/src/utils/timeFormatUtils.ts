import { getLocale, getTimeZone } from "@phoenix/utils/timeUtils";

/**
 * Creates a time formatter from a pattern
 * NB: this is intentionally made strict to Date for safety
 * @param pattern - The pattern to use for the formatter
 * @returns A time formatter
 */
export type TimeFormatter = (date: Date) => string;

/**
 * A time range formatter
 */
export type TimeRangeFormatter = (timeRange: OpenTimeRange) => string;

/**
 * Options for displaying time in a specific locale and timezone
 */
export type TimeDisplayOptions = {
  /**
   * The locale to use for the formatter
   */
  locale: string;
  /**
   * The timezone to use for the formatter
   */
  timeZone: string;
};
/**
 * Creates a time formatter from a locale and options
 * @param locale - The locale to use for the formatter
 * @param options - The options to use for the formatter
 * @returns A time formatter
 */
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
 * Creates a full time formatter
 * @param displayOptions - The display options to use for the formatter
 * @returns A full time formatter
 */
export function createFullTimeFormatter(
  displayOptions: TimeDisplayOptions
): TimeFormatter {
  const { locale, timeZone } = displayOptions;
  return createTimeFormatter(locale, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
    timeZone,
  });
}

/**
 * Creates a short time formatter
 * @param displayOptions - The display options to use for the formatter
 * @returns A short time formatter
 */
export function createShortTimeFormatter(
  displayOptions: TimeDisplayOptions
): TimeFormatter {
  const { locale, timeZone } = displayOptions;
  return createTimeFormatter(locale, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone,
  });
}

/**
 * Creates a time range formatter
 * @param displayOptions - The display options to use for the formatter
 * @returns A time range formatter
 */
export function createTimeRangeFormatter(
  displayOptions: TimeDisplayOptions
): TimeRangeFormatter {
  const fullTimeFormatter = createFullTimeFormatter(displayOptions);
  return (timeRange: OpenTimeRange) => {
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
}

/**
 * A full time formatter using the browser's locale and timezone
 */
export const fullTimeFormatter = createFullTimeFormatter({
  locale: getLocale(),
  timeZone: getTimeZone(),
});

/**
 * A short time formatter using the browser's locale and timezone
 */
export const shortTimeFormatter = createShortTimeFormatter({
  locale: getLocale(),
  timeZone: getTimeZone(),
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
 * Formats a time range as a string using the browser's locale and timezone
 */
export const timeRangeFormatter = createTimeRangeFormatter({
  locale: getLocale(),
  timeZone: getTimeZone(),
});

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
