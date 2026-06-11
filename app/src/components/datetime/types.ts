export type LastNTimeRangeUnit = "m" | "h" | "d";

/**
 * A relative, open-ended time window expressed as a quantity and unit, e.g.
 * "15m", "12h", "30d". A fixed set of these is offered as presets
 * (see LAST_N_TIME_RANGES) but any positive quantity is a valid key.
 */
export type LastNTimeRangeKey = `${number}${LastNTimeRangeUnit}`;

export type CustomTimeRangeKey = "custom";

export type TimeRangeKey = LastNTimeRangeKey | CustomTimeRangeKey;

export type LastNTimeRange = { key: LastNTimeRangeKey; label: string };

/**
 * Represents the state of the time range selector. There's a notion of a time range key (e.g. "7d") and the actual time range itself.
 */
export interface OpenTimeRangeWithKey extends OpenTimeRange {
  timeRangeKey: TimeRangeKey;
}
