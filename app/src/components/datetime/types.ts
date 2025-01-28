export type LastNTimeRangeKey =
  | "15m"
  | "1h"
  | "12h"
  | "1d"
  | "7d"
  | "30d"
  | "all";

export type CustomTimeRangeKey = "custom";

export type TimeRangeKey = LastNTimeRangeKey | CustomTimeRangeKey;

export type LastNTimeRange = { key: LastNTimeRangeKey; label: string };
