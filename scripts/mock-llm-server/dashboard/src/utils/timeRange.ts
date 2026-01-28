export type TimeRange = "10m" | "30m" | "60m";

export function getTimeRangeMs(range: TimeRange): number {
  switch (range) {
    case "10m":
      return 10 * 60 * 1000;
    case "30m":
      return 30 * 60 * 1000;
    case "60m":
      return 60 * 60 * 1000;
  }
}
