import React, {
  createContext,
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
  children,
}: {
  children: React.ReactNode;
}) => {
  const [selectedTimestamp, _setSelectedTimestamp] = useState<Date | null>(
    getInitialSelectedTimestamp()
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

/**
 * Utility function for retrieving the selected timestamp used for calculating drift
 */
function getInitialSelectedTimestamp(): Date | null {
  const searchParams = new URLSearchParams(window.location.search);

  const endTimeslice = searchParams.get("timestamp");
  if (endTimeslice != null) {
    return new Date(parseInt(endTimeslice));
  }
  return null;
}
