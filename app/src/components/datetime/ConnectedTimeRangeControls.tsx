import { startTransition, useCallback } from "react";

import { useTimeRange } from "./TimeRangeContext";
import type { TimeRangeControlsProps } from "./TimeRangeControls";
import { TimeRangeControls } from "./TimeRangeControls";
import type { OpenTimeRangeWithKey } from "./types";

/**
 * Time range controls wired to the shared time range context, for use beside
 * a ConnectedTimeRangeSelector. Live-streaming props pass through; omit them
 * for a pure pan/zoom strip.
 */
export function ConnectedTimeRangeControls(
  props: Omit<TimeRangeControlsProps, "value" | "onChange">
) {
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
    <TimeRangeControls {...props} value={timeRange} onChange={setTimeRange} />
  );
}
