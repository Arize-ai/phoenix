import {
  startOfHour,
  startOfMinute,
  subDays,
  subHours,
  subMinutes,
} from "date-fns";

import { assertUnreachable } from "@phoenix/typeUtils";

import { LAST_N_TIME_RANGES } from "./constants";
import { LastNTimeRangeKey, TimeRangeKey } from "./types";

export function getTimeRangeFromLastNTimeRangeKey(
  key: LastNTimeRangeKey
): OpenTimeRange {
  const now = Date.now();
  switch (key) {
    case "15m":
      return {
        start: startOfMinute(subMinutes(now, 15)),
      };
    case "1h":
      return {
        start: startOfMinute(subHours(now, 1)),
      };
    case "12h":
      return {
        start: startOfHour(subHours(now, 12)),
      };
    case "1d":
      return {
        start: startOfHour(subDays(now, 1)),
      };
    case "7d":
      return {
        start: startOfHour(subDays(now, 7)),
      };
    case "30d":
      return {
        start: startOfHour(subDays(now, 30)),
      };
    default:
      assertUnreachable(key);
  }
}

/**
 * Type guard for the last N time range key
 */
export function isLastNTimeRangeKey(key: unknown): key is LastNTimeRangeKey {
  return LAST_N_TIME_RANGES.some((range) => range.key === key);
}
/**
 * Type guard for the time range key
 */
export function isTimeRangeKey(key: unknown): key is TimeRangeKey {
  return isLastNTimeRangeKey(key) || key === "custom";
}
