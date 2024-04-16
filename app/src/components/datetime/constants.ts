import { LastNTimeRange, LastNTimeRangeKey } from "./types";

export const LAST_N_TIME_RANGES: LastNTimeRange[] = [
  { key: "1d", label: "Last Day" },
  { key: "7d", label: "Last 7 Days" },
  { key: "30d", label: "Last Month" },
  { key: "all", label: "All Time" },
];

export const LAST_N_TIME_RANGES_MAP = LAST_N_TIME_RANGES.reduce(
  (acc, range) => ({ ...acc, [range.key]: range }),
  {} as Record<LastNTimeRangeKey, LastNTimeRange | undefined>
);
