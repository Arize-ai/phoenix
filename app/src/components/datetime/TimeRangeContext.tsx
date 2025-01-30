import React, { createContext, useState } from "react";

import { usePreferencesContext } from "@phoenix/contexts/PreferencesContext";

import { LAST_N_TIME_RANGES } from "./constants";
import { OpenTimeRangeWithKey } from "./types";
import { getTimeRangeFromLastNTimeRangeKey } from "./utils";

export type TimeRangeContextType = {
  timeRange: OpenTimeRangeWithKey;
  setTimeRange: (timeRange: OpenTimeRangeWithKey) => void;
};

export const TimeRangeContext = createContext<TimeRangeContextType | null>(
  null
);

export function useTimeRange(): TimeRangeContextType {
  const context = React.useContext(TimeRangeContext);
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

  // Default to the last N time range stored in preferences
  const [timeRange, setTimeRange] = useState<OpenTimeRangeWithKey>(() => {
    // Just to be safe, we check if the stored time range key is valid
    if (
      LAST_N_TIME_RANGES.map((timeRange) => timeRange.key).includes(
        storedLastNTimeRangeKey
      )
    ) {
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
