import React, {
  createContext,
  startTransition,
  useCallback,
  useState,
} from "react";

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
  initialTimeRangeKey = "7d",
  children,
}: {
  initialTimeRangeKey?: LastNTimeRangeKey;
  children: React.ReactNode;
}) {
  const [timeRangeKey, _setTimeRangeKey] =
    useState<LastNTimeRangeKey>(initialTimeRangeKey);
  const [timeRange, _setTimeRange] = useState<TimeRange>(() => {
    return getTimeRangeFromLastNTimeRangeKey(initialTimeRangeKey);
  });
  const setTimeRangeKey = useCallback((key: LastNTimeRangeKey) => {
    startTransition(() => {
      _setTimeRangeKey(key);
      _setTimeRange(getTimeRangeFromLastNTimeRangeKey(key));
    });
  }, []);
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
