import React, { createContext } from "react";

import { usePreferencesContext } from "@phoenix/contexts/PreferencesContext";

import { LastNTimeRangeKey } from "./types";
import { getTimeRangeFromLastNTimeRangeKey } from "./utils";

export type LastNTimeRangeContextType = {
  /**
   * The preset time range key
   * @example "7d"
   * @default "7d"
   */
  timeRangeKey: LastNTimeRangeKey;
  setTimeRangeKey: (key: LastNTimeRangeKey) => void;
  /**
   * The materialized time range based on the key
   */
  timeRange: TimeRange;
};

export const LastNTimeRangeContext =
  createContext<LastNTimeRangeContextType | null>(null);

export function useLastNTimeRange(): LastNTimeRangeContextType {
  const context = React.useContext(LastNTimeRangeContext);
  if (context === null) {
    throw new Error(
      "useLastNTimeRange must be used within a LastNTimeRangeProvider"
    );
  }
  return context;
}

export function LastNTimeRangeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const timeRangeKey = usePreferencesContext(
    (state) => state.lastNTimeRangeKey
  );
  const setTimeRangeKey = usePreferencesContext(
    (state) => state.setLastNTimeRangeKey
  );

  // TODO: this caching doesn't move the time forward and is flawed
  // Needs refactoring
  const timeRange = getTimeRangeFromLastNTimeRangeKey(timeRangeKey);

  return (
    <LastNTimeRangeContext.Provider
      value={{
        timeRangeKey,
        setTimeRangeKey,
        timeRange,
      }}
    >
      {children}
    </LastNTimeRangeContext.Provider>
  );
}
