import { timeFormat } from "d3-time-format";

/**
 * Formats time to be displayed in full
 * e.x. in a tooltip
 */
export const fullTimeFormatter = timeFormat("%x %H:%M:%S %p");

/**
 * Formats time to be displayed in short (no year or date)
 * e.x. in a tooltip
 */
export const shortTimeFormatter = timeFormat("%H:%M %p");

export const shortDateTimeFormatter = timeFormat("%x %H:%M %p");
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
