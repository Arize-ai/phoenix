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

  // Default to the last N time range stored in preferences
  const [timeRange, _setTimeRange] = useState<OpenTimeRangeWithKey>(() => {
    // Just to be safe, we check if the stored time range key is valid
    if (isLastNTimeRangeKey(storedLastNTimeRangeKey)) {
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
      // Store the last N time range key in preferences
      if (isLastNTimeRangeKey(timeRange.timeRangeKey)) {
        setStoredLastNTimeRangeKey(timeRange.timeRangeKey);
      }
    },
    [setStoredLastNTimeRangeKey]
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
