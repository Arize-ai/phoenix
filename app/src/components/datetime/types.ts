export type LastNTimeRangeKey = "15m" | "1h" | "12h" | "1d" | "7d" | "30d";

export type CustomTimeRangeKey = "custom";

export type TimeRangeKey = LastNTimeRangeKey | CustomTimeRangeKey;

export type LastNTimeRange = { key: LastNTimeRangeKey; label: string };

/**
 * Represents the state of the time range selector. There's a notion of a time range key (e.g. "7d") and the actual time range itself.
 */
export interface OpenTimeRangeWithKey extends OpenTimeRange {
  timeRangeKey: TimeRangeKey;
}
