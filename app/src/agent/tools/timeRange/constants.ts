export const SET_TIME_RANGE_TOOL_NAME = "set_time_range";

/**
 * **Drift warning:** These allowed `timeRangeKey` values must stay in sync with
 * the server-side enum in
 * `src/phoenix/server/agents/tools/external/set_time_range.py`
 * (`_SET_TIME_RANGE_PARAMETERS["properties"]["timeRangeKey"]["enum"]`) and
 * the shared TypeScript type `TimeRangeKey` in
 * `app/src/components/datetime/types.ts`.
 */
export const TIME_RANGE_KEYS = [
  "15m",
  "1h",
  "12h",
  "1d",
  "7d",
  "30d",
  "custom",
];
