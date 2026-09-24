import { useEffect, useState } from "react";

/**
 * Returns `false` until the component has stayed mounted for `delayMs`, then
 * `true`. Gates work that is only worth doing once a surface has stopped
 * flickering past: a tooltip that opens on every row the pointer crosses
 * shows what it already has at once, and fetches more only for the row the
 * pointer rests on.
 */
export function useSettled(delayMs: number): boolean {
  const [hasSettled, setHasSettled] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => {
      setHasSettled(true);
    }, delayMs);
    return () => {
      clearTimeout(timer);
    };
  }, [delayMs]);
  return hasSettled;
}
