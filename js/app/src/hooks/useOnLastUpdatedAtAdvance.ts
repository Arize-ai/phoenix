import { startTransition, useEffect, useEffectEvent, useRef } from "react";

import { useTimeRange } from "@phoenix/components/datetime";

/**
 * Watch a polled last-updated timestamp and, each time it moves past the one
 * the page's data was loaded against, re-anchor a live time range to "now"
 * and call `onAdvance` in a transition. The first timestamp seen is the
 * baseline. The callback always sees the latest render, so callers pass a
 * fresh closure without it becoming a dependency.
 */
export function useOnLastUpdatedAtAdvance(
  lastUpdatedAt: string | null,
  onAdvance: (lastUpdatedAt: string) => void
) {
  const { refreshLiveTimeRange } = useTimeRange();
  const loadedLastUpdatedAtRef = useRef(lastUpdatedAt);
  const onAdvanceEvent = useEffectEvent((nextLastUpdatedAt: string) => {
    startTransition(() => {
      refreshLiveTimeRange();
      onAdvance(nextLastUpdatedAt);
    });
  });
  useEffect(() => {
    if (
      lastUpdatedAt != null &&
      (loadedLastUpdatedAtRef.current == null ||
        loadedLastUpdatedAtRef.current < lastUpdatedAt)
    ) {
      // Record the new timestamp so the effect doesn't fire again for it
      loadedLastUpdatedAtRef.current = lastUpdatedAt;
      onAdvanceEvent(lastUpdatedAt);
    }
  }, [lastUpdatedAt]);
}
