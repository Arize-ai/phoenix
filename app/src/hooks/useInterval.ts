import { useEffect, useRef } from "react";

type Callback = () => void;

/**
 * Custom hook to use setInterval with React hooks
 * @param callback
 * @param {number | null} delay - if set to null, no interval will be set
 */
export function useInterval(callback: Callback, delay: number | null) {
  const savedCallback = useRef<Callback | null>(null);

  // Remember the latest callback.
  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  // Set up the interval.
  useEffect(() => {
    function tick() {
      if (savedCallback.current) {
        savedCallback.current();
      }
    }
    if (typeof delay === "number") {
      const id = setInterval(tick, delay);
      return () => clearInterval(id);
    }
  }, [delay]);
}
