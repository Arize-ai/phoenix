import { startTransition, useCallback } from "react";

import { useTimeRange } from "./TimeRangeContext";
import { TimeRangeSelector } from "./TimeRangeSelector";
import { OpenTimeRangeWithKey } from "./types";

export function ConnectedLastNTimeRangePicker() {
  const { timeRange, setTimeRange: _setTimeRange } = useTimeRange();
  const setTimeRange = useCallback(
    (timeRange: OpenTimeRangeWithKey) => {
      startTransition(() => {
        _setTimeRange(timeRange);
      });
    },
    [_setTimeRange]
  );
  return <TimeRangeSelector value={timeRange} onChange={setTimeRange} />;
}
