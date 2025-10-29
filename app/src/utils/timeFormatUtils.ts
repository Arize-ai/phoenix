import { timeFormat, utcFormat } from "d3-time-format";

/**
 * Formats time to be displayed in full
 * e.x. in a tooltip
 */
export const fullTimeFormatter = timeFormat("%x %H:%M:%S %p");
export const fullTimeFormatterUTC = utcFormat("%x %H:%M:%S %p");

/**
 * Formats time to be displayed in short (no year or date)
 * e.x. in a tooltip
 */
export const shortTimeFormatter = timeFormat("%H:%M %p");
export const shortTimeFormatterUTC = utcFormat("%H:%M %p");

export const shortDateTimeFormatter = timeFormat("%x %H:%M %p");
export const shortDateTimeFormatterUTC = utcFormat("%x %H:%M %p");

/**
 * Get the appropriate time formatter based on timezone preference
 */
export function getFullTimeFormatter(timezone: "local" | "UTC") {
  return timezone === "UTC" ? fullTimeFormatterUTC : fullTimeFormatter;
}

export function getShortTimeFormatter(timezone: "local" | "UTC") {
  return timezone === "UTC" ? shortTimeFormatterUTC : shortTimeFormatter;
}

export function getShortDateTimeFormatter(timezone: "local" | "UTC") {
  return timezone === "UTC"
    ? shortDateTimeFormatterUTC
    : shortDateTimeFormatter;
}

export const timeRangeFormatter = (
  timeRange: OpenTimeRange,
  timezone: "local" | "UTC" = "local"
) => {
  const formatter = getFullTimeFormatter(timezone);
  if (timeRange.start && timeRange.end) {
    return `${formatter(timeRange.start)} - ${formatter(timeRange.end)}`;
  } else if (timeRange.start) {
    return `From ${formatter(timeRange.start)}`;
  } else if (timeRange.end) {
    return `Until ${formatter(timeRange.end)}`;
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
