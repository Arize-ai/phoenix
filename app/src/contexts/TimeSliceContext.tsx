import React, {
  createContext,
  PropsWithChildren,
  startTransition,
  useContext,
  useState,
} from "react";

export type TimeSliceContextType = {
  selectedTimestamp: Date | null;
  setSelectedTimestamp: (timestamp: Date | null) => void;
};

/**
 * Context for what slice of time the user is selecting
 * In particular, for a drift monitor, the specific event
 * that the user wants to analyze
 */
const TimeSliceContext = createContext<TimeSliceContextType | null>(null);

export const useTimeSlice = (): TimeSliceContextType => {
  const context = useContext(TimeSliceContext);
  if (context === null) {
    throw new Error("useTimeSlice must be used within a TimeSliceProvider");
  }
  return context;
};

export const TimeSliceContextProvider = ({
  initialTimestamp,
  children,
}: PropsWithChildren<{
  initialTimestamp: Date | null;
}>) => {
  const [selectedTimestamp, _setSelectedTimestamp] = useState<Date | null>(
    initialTimestamp
  );

  const setSelectedTimestamp = (newTimestamp: Date | null) => {
    startTransition(() => {
      _setSelectedTimestamp(newTimestamp);
    });
  };

  return (
    <TimeSliceContext.Provider
      value={{
        selectedTimestamp,
        setSelectedTimestamp,
      }}
    >
      {children}
    </TimeSliceContext.Provider>
  );
};
