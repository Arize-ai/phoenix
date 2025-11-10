import { useEffect, useState } from "react";

let _nowEpochMs = Date.now();

type UseCurrentTimeProps = {
  /**
   * The interval at which the current time will be updated. If set to null, the current time will stay fixed.
   * @default null
   */
  updateIntervalMs?: number | null;
};
export function useCurrentTime(props: UseCurrentTimeProps) {
  const { updateIntervalMs = null } = props;
  const [nowEpochMs, setNowEpochMs] = useState<number>(_nowEpochMs);
  useEffect(() => {
    if (typeof updateIntervalMs !== "number") {
      return;
    }
    const interval = setInterval(() => {
      // update the global so that subsiquent mounts
      _nowEpochMs = Date.now();
      // update via state callback to avoid setting state in the effect
      setNowEpochMs(_nowEpochMs);
    }, updateIntervalMs);
    return () => clearInterval(interval);
  }, [updateIntervalMs]);
  return nowEpochMs;
}
