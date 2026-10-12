import { useEffect } from "react";
import type { Blocker } from "react-router";
import { useBlocker } from "react-router";

/**
 * Guards unsaved work against navigation. In-app navigation to a different
 * path is blocked and surfaced through the returned blocker, which drives a
 * confirmation dialog; a reload or closed tab is confirmed by the browser.
 * Changes to the query string alone pass through.
 */
export function useUnsavedChangesBlocker({
  hasUnsavedChanges,
}: {
  hasUnsavedChanges: boolean;
}): Blocker {
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      hasUnsavedChanges && currentLocation.pathname !== nextLocation.pathname
  );
  useEffect(() => {
    if (!hasUnsavedChanges) {
      return undefined;
    }
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      // Legacy engines show the prompt only when returnValue is set.
      event.returnValue = true;
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [hasUnsavedChanges]);
  return blocker;
}
