import React, {
  createContext,
  ReactNode,
  startTransition,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import {
  addDays,
  endOfDay,
  endOfHour,
  roundToNearestMinutes,
  startOfDay,
  startOfHour,
  subDays,
} from "date-fns";

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
    switch (timePreset) {
      case TimePreset.last_day: {
        const endTimeBounds = roundToNearestMinutes(
          endOfHour(timeRangeBounds.end),
          { roundingMethod: "floor" }
        );
        return {
          start: subDays(endTimeBounds, 1),
          end: endTimeBounds,
        };
      }
      case TimePreset.last_week: {
        const endTimeBounds = roundToNearestMinutes(
          endOfDay(timeRangeBounds.end),
          { roundingMethod: "floor" }
        );
        return {
          start: subDays(endTimeBounds, 7),
          end: endTimeBounds,
        };
      }
      case TimePreset.last_month: {
        const endTimeBounds = roundToNearestMinutes(
          endOfDay(timeRangeBounds.end),
          { roundingMethod: "floor" }
        );
        return {
          start: subDays(endTimeBounds, 30),
          end: endTimeBounds,
        };
      }
      case TimePreset.last_3_months: {
        const endTimeBounds = roundToNearestMinutes(
          endOfDay(timeRangeBounds.end),
          { roundingMethod: "floor" }
        );
        return {
          start: subDays(endTimeBounds, 90),
          end: endTimeBounds,
        };
      }
      case TimePreset.first_day: {
        const startTimeBounds = startOfHour(timeRangeBounds.start);
        return {
          start: startTimeBounds,
          end: addDays(startTimeBounds, 1),
        };
      }
      case TimePreset.first_week: {
        const startTimeBounds = startOfDay(timeRangeBounds.start);
        return {
          start: startTimeBounds,
          end: addDays(startTimeBounds, 7),
        };
      }
      case TimePreset.first_month: {
        const startTimeBounds = startOfDay(timeRangeBounds.start);
        return {
          start: startTimeBounds,
          end: addDays(startTimeBounds, 30),
        };
      }
      case TimePreset.all: {
        const endTimeBounds = roundToNearestMinutes(
          endOfDay(timeRangeBounds.end),
          { roundingMethod: "floor" }
        );
        const startTimeBounds = startOfDay(timeRangeBounds.start);
        return {
          start: startTimeBounds,
          end: endTimeBounds,
        };
      }
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
