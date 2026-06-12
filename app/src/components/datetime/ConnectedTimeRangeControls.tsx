import { useTimeRange } from "./TimeRangeContext";
import type { TimeRangeControlsProps } from "./TimeRangeControls";
import { TimeRangeControls } from "./TimeRangeControls";

/**
 * Time range controls wired to the shared time range context, for use beside
 * a ConnectedTimeRangeSelector. Live-streaming props pass through; omit them
 * for a pure pan/zoom strip.
 */
export function ConnectedTimeRangeControls(
  props: Omit<TimeRangeControlsProps, "value" | "onChange">
) {
  const { timeRange, setTimeRangeInTransition } = useTimeRange();
  return (
    <TimeRangeControls
      {...props}
      value={timeRange}
      onChange={setTimeRangeInTransition}
    />
  );
}
