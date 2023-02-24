import React, {
  createContext,
  useContext,
  ReactNode,
  useState,
  useMemo,
  useCallback,
  startTransition,
} from "react";
import { assertUnreachable } from "../typeUtils";
import { subDays } from "date-fns";

/**
 * Preset amounts of time to select from
 */
export enum TimePreset {
  last_day = "Last Day",
  last_week = "Last Week",
  last_month = "Last Month",
}
/**
 * The state stored in context for the overall time range of the app
 */
type TimeRangeContextType = {
  timeRange: TimeRange;
  timePreset: TimePreset;
  setTimePreset: (preset: TimePreset) => void;
};

export const TimeRangeContext = createContext<TimeRangeContextType | null>(
  null
);

export function useTimeRange() {
  const context = useContext(TimeRangeContext);
  if (context === null) {
    throw new Error("useTimeRange must be used within a TimeRangeProvider");
  }
  return context;
}

type TimeRangeProviderProps = {
  children: ReactNode;
  /**
   * The min and max time range of the application (typically the min and max of the primary dataset)
   */
  timeRangeBounds: TimeRange;
};

function useTimeRangeMemo(timePreset: TimePreset, timeRangeBounds: TimeRange) {
  const timeRange = useMemo(() => {
    switch (timePreset) {
      case TimePreset.last_day:
        return {
          start: subDays(timeRangeBounds.end, 1),
          end: timeRangeBounds.end,
        };
      case TimePreset.last_week:
        return {
          start: subDays(timeRangeBounds.end, 7),
          end: timeRangeBounds.end,
        };
      case TimePreset.last_month:
        return {
          start: subDays(timeRangeBounds.end, 30),
          end: timeRangeBounds.end,
        };
      default:
        assertUnreachable(timePreset);
    }
  }, [timePreset, timeRangeBounds]);
  return timeRange;
}

export function TimeRangeProvider(props: TimeRangeProviderProps) {
  const [timePreset, _setTimePreset] = useState(TimePreset.last_month);
  const timeRange = useTimeRangeMemo(timePreset, props.timeRangeBounds);
  const setTimePreset = useCallback((preset: TimePreset) => {
    startTransition(() => {
      _setTimePreset(preset);
    });
  }, []);
  return (
    <TimeRangeContext.Provider value={{ timeRange, timePreset, setTimePreset }}>
      {props.children}
    </TimeRangeContext.Provider>
  );
}
