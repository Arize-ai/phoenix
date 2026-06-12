import type { ComponentSize } from "@phoenix/components/core/types";

import { useTimeRange } from "./TimeRangeContext";
import { TimeRangeSelector } from "./TimeRangeSelector";

export function ConnectedTimeRangeSelector({
  size = "S",
}: {
  size?: ComponentSize;
}) {
  const { timeRange, setTimeRangeInTransition } = useTimeRange();
  return (
    <TimeRangeSelector
      value={timeRange}
      onChange={setTimeRangeInTransition}
      size={size}
    />
  );
}
