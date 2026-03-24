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
 * Creates a short date time formatter (date + time without seconds)
 * @param displayOptions - The display options to use for the formatter
 * @returns A short date time formatter
 */
export function createShortDateTimeFormatter(
  displayOptions: TimeDisplayOptions
): TimeFormatter {
  const { locale, timeZone } = displayOptions;
  return createTimeFormatter(locale, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
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
 * A function that returns the offset string for a given timezone
 * @param params - The parameters to use for the formatter
 * @returns The offset string
 */
export function getTimeZoneShortName(
  params: TimeDisplayOptions
): string | undefined {
  const { timeZone, locale } = params;
  return Intl.DateTimeFormat(locale, {
    timeZoneName: "short",
    timeZone,
  })
    .formatToParts()
    .find((i) => i.type === "timeZoneName")?.value;
}

const MILLISECONDS_PER_DAY = 1000 * 60 * 60 * 24;

/**
 * Formats a Unix timestamp relative to now for compact display in lists.
 *
 * Returns "Today", "Yesterday", "N days ago" (up to 6), or a locale-
 * formatted short date for anything older.
 *
 * @param timestamp - Unix timestamp in milliseconds. Returns empty string if 0.
 * @param now - optional "now" timestamp for testability (defaults to Date.now())
 */
export function formatRelativeDate(
  timestamp: number,
  now: number = Date.now()
): string {
  if (timestamp === 0) return "";

  const diffDays = Math.floor((now - timestamp) / MILLISECONDS_PER_DAY);

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;

  return new Date(timestamp).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

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
