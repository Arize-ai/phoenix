import { useEffect, useRef } from "react";

type Callback = () => void;

/**
 * Custom hook to use setInterval with React hooks
 * @param callback
 * @param {number | undefined} delay - pass undefined to stop the interval
 */
export function useInterval(callback: Callback, delay?: number) {
  const savedCallback = useRef<Callback | null>(null);

  // Remember the latest callback.
  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  // Set up the interval.
  useEffect(() => {
    function tick() {
      savedCallback.current && savedCallback.current();
    }
    const id = setInterval(tick, delay);
    return () => clearInterval(id);
  }, [delay]);
}
