import { useSyncExternalStore } from "react";

/**
 * Subscribes to a CSS media query and returns whether it currently matches.
 * The component re-renders whenever the match state changes (e.g. on window
 * resize across the query's breakpoint).
 *
 * @example
 * const isLargeScreen = useMediaQuery("(min-width: 900px)");
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = (onStoreChange: () => void) => {
    const mediaQueryList = window.matchMedia(query);
    mediaQueryList.addEventListener("change", onStoreChange);
    return () => mediaQueryList.removeEventListener("change", onStoreChange);
  };
  const getSnapshot = () => window.matchMedia(query).matches;
  return useSyncExternalStore(subscribe, getSnapshot);
}
