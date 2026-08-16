import type { TimeRangeKey } from "@phoenix/components/datetime/types";

export type SetTimeRangeInput = {
  timeRangeKey: TimeRangeKey;
  startTime?: string;
  endTime?: string;
};
