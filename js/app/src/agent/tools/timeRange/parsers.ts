import type { TimeRangeKey } from "@phoenix/components/datetime/types";

import { TIME_RANGE_KEYS } from "./constants";
import type { SetTimeRangeInput } from "./types";

export function isValidTimeRangeKey(value: unknown): value is TimeRangeKey {
  return typeof value === "string" && TIME_RANGE_KEYS.includes(value);
}

/** Parse and validate the set_time_range tool input. */
export function parseSetTimeRangeInput(
  input: unknown
): SetTimeRangeInput | null {
  if (typeof input !== "object" || input === null) return null;
  const candidate = input as {
    timeRangeKey?: unknown;
    startTime?: unknown;
    endTime?: unknown;
  };
  if (!isValidTimeRangeKey(candidate.timeRangeKey)) {
    return null;
  }
  if (
    candidate.startTime !== undefined &&
    typeof candidate.startTime !== "string"
  ) {
    return null;
  }
  if (
    candidate.endTime !== undefined &&
    typeof candidate.endTime !== "string"
  ) {
    return null;
  }
  return {
    timeRangeKey: candidate.timeRangeKey,
    ...(candidate.startTime !== undefined
      ? { startTime: candidate.startTime }
      : {}),
    ...(candidate.endTime !== undefined ? { endTime: candidate.endTime } : {}),
  };
}
