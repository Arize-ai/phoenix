import { useEffect, useRef } from "react";

type Callback = () => void;

/**
 * setInterval that automatically pauses when the page tab is hidden
 * and fires immediately upon becoming visible again.
 * @param callback - function to call on each tick
 * @param delay - interval in ms, or null to disable
 */
export function useInterval(callback: Callback, delay: number | null) {
  const savedCallback = useRef<Callback | null>(null);

  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    if (typeof delay !== "number") return;

    const intervalMs = delay;

    function tick() {
      savedCallback.current?.();
    }

    let id: ReturnType<typeof setInterval> | null = setInterval(
      tick,
      intervalMs
    );

    function onVisibilityChange() {
      if (document.visibilityState === "hidden") {
        if (id != null) {
          clearInterval(id);
          id = null;
        }
      } else {
        if (id == null) {
          tick();
          id = setInterval(tick, intervalMs);
        }
      }
    }

    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      if (id != null) clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [delay]);
}
