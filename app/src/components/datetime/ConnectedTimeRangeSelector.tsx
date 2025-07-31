import { startTransition, useCallback } from "react";

import { ComponentSize } from "@phoenix/components/types";

import { useTimeRange } from "./TimeRangeContext";
import { TimeRangeSelector } from "./TimeRangeSelector";
import { OpenTimeRangeWithKey } from "./types";

export function ConnectedTimeRangeSelector({
  size = "S",
}: {
  size?: ComponentSize;
}) {
  const { timeRange, setTimeRange: _setTimeRange } = useTimeRange();
  const setTimeRange = useCallback(
    (timeRange: OpenTimeRangeWithKey) => {
      startTransition(() => {
        _setTimeRange(timeRange);
      });
    },
    [_setTimeRange]
  );
  return (
    <TimeRangeSelector value={timeRange} onChange={setTimeRange} size={size} />
  );
}
