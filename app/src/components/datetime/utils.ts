import {
  startOfHour,
  startOfMinute,
  subDays,
  subHours,
  subMinutes,
} from "date-fns";

import { assertUnreachable } from "@phoenix/typeUtils";

import { LAST_N_TIME_RANGES } from "./constants";
import type { LastNTimeRangeKey, TimeRangeKey } from "./types";

const MINUTE_IN_MS = 60 * 1000;
const HOUR_IN_MS = 60 * MINUTE_IN_MS;

export function getTimeRangeFromLastNTimeRangeKey(
  key: LastNTimeRangeKey
): OpenTimeRange {
  const now = Date.now();
  switch (key) {
    case "15m":
      return {
        start: startOfMinute(subMinutes(now, 15)),
        end: null,
      };
    case "1h":
      return {
        start: startOfMinute(subHours(now, 1)),
        end: null,
      };
    case "12h":
      return {
        start: startOfHour(subHours(now, 12)),
        end: null,
      };
    case "1d":
      return {
        start: startOfHour(subDays(now, 1)),
        end: null,
      };
    case "7d":
      return {
        start: startOfHour(subDays(now, 7)),
        end: null,
      };
    case "30d":
      return {
        start: startOfHour(subDays(now, 30)),
        end: null,
      };
    default:
      assertUnreachable(key);
  }
}

export function getMillisecondsUntilNextLastNTimeRangeRefresh(
  key: LastNTimeRangeKey
): number {
  const interval = key === "15m" || key === "1h" ? MINUTE_IN_MS : HOUR_IN_MS;
  const elapsed = Date.now() % interval;
  return elapsed === 0 ? interval : interval - elapsed;
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
