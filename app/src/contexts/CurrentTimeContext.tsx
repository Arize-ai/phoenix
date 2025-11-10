import {
  createContext,
  PropsWithChildren,
  useContext,
  useEffect,
  useState,
} from "react";

export type CurrentTimeContextType = {
  /**
   * The current time in epoch milliseconds.
   */
  nowEpochMs: number;
};

export const CurrentTimeContext = createContext<CurrentTimeContextType | null>(
  null
);

export function useCurrentTime(): CurrentTimeContextType {
  const context = useContext(CurrentTimeContext);
  if (context === null) {
    throw new Error("useCurrentTime must be used within a CurrentTimeProvider");
  }
  return context;
}
const NOW_EPOCH_MS_UPDATE_INTERVAL_MS = 10000;

let _nowEpochMs = Date.now();

export function CurrentTimeProvider(props: PropsWithChildren) {
  const [nowEpochMs, setNowEpochMs] = useState<number>(_nowEpochMs);
  useEffect(() => {
    const interval = setInterval(() => {
      _nowEpochMs = Date.now();
      // update via state callback to avoid setting state in the effect
      setNowEpochMs(_nowEpochMs);
    }, NOW_EPOCH_MS_UPDATE_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);
  return (
    <CurrentTimeContext.Provider value={{ nowEpochMs }}>
      {props.children}
    </CurrentTimeContext.Provider>
  );
}
