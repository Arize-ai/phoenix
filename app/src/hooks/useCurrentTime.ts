import { useEffect, useState } from "react";

type UseCurrentTimeProps = {
  /**
   * The interval at which the current time will be updated. If set to null, the current time will stay fixed.
   * This is by design as we want the component that uses the hook to have explicit control over it's rendering behavior
   * @default null
   */
  updateIntervalMs?: number | null;
};

type CurrentTimeValue = {
  nowEpochMs: number;
};
/**
 * A react hook that makes makes the current time idenponent
 * @param props - The props for the hook
 * @returns The current time value
 */
export function useCurrentTime(
  props: UseCurrentTimeProps = {}
): CurrentTimeValue {
  const { updateIntervalMs = null } = props;
  const [nowEpochMs, setNowEpochMs] = useState<number>(() => Date.now());
  useEffect(() => {
    if (typeof updateIntervalMs !== "number") {
      return;
    }
    const interval = setInterval(() => {
      // update via state callback to avoid setting state in the effect
      setNowEpochMs(Date.now());
    }, updateIntervalMs);
    return () => clearInterval(interval);
  }, [updateIntervalMs]);
  return { nowEpochMs };
}
