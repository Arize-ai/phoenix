import { useCallback, useEffect, useRef, useState } from "react";

const INTERVAL_MS = 250;

export const useTimeoutRemainingPercentage = (
  timeout: number | undefined | null
) => {
  const [pauseTimer, setPauseTimer] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(() => {
    if (timeout) {
      return Math.max(timeout - INTERVAL_MS * 2, 0);
    }

    return null;
  });
  const initialTimeRemaining = useRef(timeRemaining);
  // update initial time remaining when the toast timeout definition changes
  useEffect(() => {
    if (timeout) {
      setTimeRemaining(Math.max(timeout - INTERVAL_MS * 2, 0));
    }
  }, [timeout]);
  // count down from timeRemaining, if set by the toast timeout
  useEffect(() => {
    if (initialTimeRemaining.current === null) return;
    if (pauseTimer) {
      return;
    }
    const interval = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev === null) return null;
        if (prev <= INTERVAL_MS) {
          clearInterval(interval);
          return 0;
        }
        return prev - INTERVAL_MS;
      });
    }, INTERVAL_MS);
    return () => clearInterval(interval);
  }, [pauseTimer]);

  const timePercentageRemaining =
    timeRemaining !== null ? (timeRemaining / (timeout || 1)) * 100 : undefined;

  const pauseTimerCallback = useCallback(() => {
    setPauseTimer(true);
  }, []);

  const unpauseTimer = useCallback(() => {
    setPauseTimer(false);
  }, []);

  return {
    timePercentageRemaining,
    pauseTimer: pauseTimerCallback,
    unpauseTimer,
  };
};
