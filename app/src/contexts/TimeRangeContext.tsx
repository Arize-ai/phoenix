import React, {
  createContext,
  ReactNode,
  startTransition,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { addDays, addSeconds, endOfHour, startOfHour, subDays } from "date-fns";

import { assertUnreachable } from "@phoenix/typeUtils";

/**
 * Preset amounts of time to select from
 */
export enum TimePreset {
  last_day = "Last Day",
  last_week = "Last Week",
  last_month = "Last Month",
  last_3_months = "Last 3 Months",
  first_day = "First Day",
  first_week = "First Week",
  first_month = "First Month",
  all = "All",
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
    // The timeRangeBounds come from the start / end of the primary dataset
    // Because our time windows are right open (don't include the right time), we need to expand it by a small amount
    const endTimeBounds = endOfHour(addSeconds(timeRangeBounds.end, 1));
    const startTimeBounds = startOfHour(timeRangeBounds.start);
    switch (timePreset) {
      case TimePreset.last_day:
        return {
          start: subDays(endTimeBounds, 1),
          end: endTimeBounds,
        };
      case TimePreset.last_week:
        return {
          start: subDays(endTimeBounds, 7),
          end: endTimeBounds,
        };
      case TimePreset.last_month:
        return {
          start: subDays(endTimeBounds, 30),
          end: endTimeBounds,
        };
      case TimePreset.last_3_months:
        return {
          start: subDays(endTimeBounds, 90),
          end: endTimeBounds,
        };
      case TimePreset.first_day:
        return {
          start: startTimeBounds,
          end: addDays(startTimeBounds, 1),
        };
      case TimePreset.first_week:
        return {
          start: startTimeBounds,
          end: addDays(startTimeBounds, 7),
        };
      case TimePreset.first_month:
        return {
          start: startTimeBounds,
          end: addDays(startTimeBounds, 30),
        };
      case TimePreset.all:
        return {
          start: startTimeBounds,
          end: endTimeBounds,
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
