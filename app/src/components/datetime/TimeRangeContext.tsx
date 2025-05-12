import React, { createContext, useCallback, useState } from "react";

import { usePreferencesContext } from "@phoenix/contexts/PreferencesContext";

import { OpenTimeRangeWithKey } from "./types";
import {
  getTimeRangeFromLastNTimeRangeKey,
  isLastNTimeRangeKey,
} from "./utils";

export type TimeRangeContextType = {
  timeRange: OpenTimeRangeWithKey;
  setTimeRange: (timeRange: OpenTimeRangeWithKey) => void;
};

export const TimeRangeContext = createContext<TimeRangeContextType | null>(
  null
);

export function useNullableTimeRangeContext() {
  return React.useContext(TimeRangeContext);
}

export function useTimeRange() {
  const context = useNullableTimeRangeContext();
  if (context === null) {
    throw new Error(
      "useTimeRange must be used within a TimeRangeContextProvider"
    );
  }
  return context;
}

export function TimeRangeProvider({ children }: { children: React.ReactNode }) {
  /**
   * Load in the last N time range key from preferences
   */
  const storedLastNTimeRangeKey = usePreferencesContext(
    (state) => state.lastNTimeRangeKey
  );
  const setStoredLastNTimeRangeKey = usePreferencesContext(
    (state) => state.setLastNTimeRangeKey
  );

  const storedCustomTimeRange = usePreferencesContext(
    (state) => state.customTimeRange
  );
  const setStoredCustomTimeRange = usePreferencesContext(
    (state) => state.setCustomTimeRange
  );

  // Default to the last N time range stored in preferences
  const [timeRange, _setTimeRange] = useState<OpenTimeRangeWithKey>(() => {
    // Handle different kinds of stored time range keys with fallback
    if (storedCustomTimeRange) {
      try {
        // Parse the stored custom range
        const { start, end } = storedCustomTimeRange;
        return {
          timeRangeKey: "custom",
          start: start ? new Date(start) : undefined,
          end: end ? new Date(end) : undefined,
        };
      } catch (e) {
        console.error("Failed to parse custom time range", e);
      }
    } else if (isLastNTimeRangeKey(storedLastNTimeRangeKey)) {
      return {
        timeRangeKey: storedLastNTimeRangeKey,
        ...getTimeRangeFromLastNTimeRangeKey(storedLastNTimeRangeKey),
      };
    } else {
      // Fall back to the default time range
      return {
        timeRangeKey: "7d",
        ...getTimeRangeFromLastNTimeRangeKey("7d"),
      };
    }
  });

  const setTimeRange = useCallback(
    (timeRange: OpenTimeRangeWithKey) => {
      _setTimeRange(timeRange);
      // Store the time range in preferences
      if (isLastNTimeRangeKey(timeRange.timeRangeKey)) {
        setStoredLastNTimeRangeKey(timeRange.timeRangeKey);
        setStoredCustomTimeRange(null);
      } else {
        const { start, end } = timeRange;
        setStoredCustomTimeRange({ start, end });
      }
    },
    [setStoredLastNTimeRangeKey, setStoredCustomTimeRange]
  );

  return (
    <TimeRangeContext.Provider
      value={{
        timeRange,
        setTimeRange,
      }}
    >
      {children}
    </TimeRangeContext.Provider>
  );
}
