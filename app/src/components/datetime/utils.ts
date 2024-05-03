import { addDays, startOfHour, subDays } from "date-fns";

import { assertUnreachable } from "@phoenix/typeUtils";

import { LastNTimeRangeKey } from "./types";

export function getTimeRangeFromLastNTimeRangeKey(
  key: LastNTimeRangeKey
): TimeRange {
  const now = Date.now();
  // Artificially set the end time to far in the future so that it is ostensibly is "current"
  // We round down to facilitate caching.
  const end = startOfHour(addDays(now, 365));
  switch (key) {
    case "1d":
      return {
        start: startOfHour(subDays(now, 1)),
        end,
      };
    case "7d":
      return {
        start: startOfHour(subDays(now, 7)),
        end,
      };
    case "30d":
      return {
        start: startOfHour(subDays(now, 30)),
        end,
      };
    case "all":
      // Set the start time to before the epoch
      return { start: new Date("01/01/1971"), end };
    default:
      assertUnreachable(key);
  }
}
