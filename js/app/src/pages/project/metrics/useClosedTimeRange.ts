import { useMemo, useRef } from "react";

import { useTimeRange } from "@phoenix/components";
import { ONE_MONTH_MS } from "@phoenix/constants/timeConstants";

/**
 * Hook that converts an open time range from context into a closed time range.
 * If the time range is already closed, it returns it as-is.
 * If it's open, it fills in missing start/end values based on a frozen "now" timestamp.
 *
 * The "now" timestamp is frozen and only updates when the context time range
 * actually changes (or when refreshKey changes), so the returned range is
 * referentially stable across unrelated re-renders.
 */
export function useClosedTimeRange({
  refreshKey,
}: {
  /**
   * Change this key to re-freeze "now", e.g. when new data is streamed in.
   * Without it, an open-ended (live) range stays closed at a stale timestamp
   * and refetches exclude data that arrived after the last freeze.
   */
  refreshKey?: string;
} = {}): TimeRange {
  const { timeRange: contextTimeRange } = useTimeRange();

  const startMs = contextTimeRange.start?.getTime() ?? null;
  const endMs = contextTimeRange.end?.getTime() ?? null;

  // Use a ref to freeze "now" until the context time range actually changes
  const lastTimestampsRef = useRef({ startMs, endMs, refreshKey });
  // eslint-disable-next-line react/purity
  const frozenNowMsRef = useRef<number>(Date.now());

  // Only update frozen "now" when the timestamps or refresh key actually change
  if (
    // eslint-disable-next-line react/refs
    lastTimestampsRef.current.startMs !== startMs ||
    // eslint-disable-next-line react/refs
    lastTimestampsRef.current.endMs !== endMs ||
    // eslint-disable-next-line react/refs
    lastTimestampsRef.current.refreshKey !== refreshKey
  ) {
    // eslint-disable-next-line react/refs
    lastTimestampsRef.current = { startMs, endMs, refreshKey };
    // eslint-disable-next-line react/purity, react/refs
    frozenNowMsRef.current = Date.now();
  }

  // eslint-disable-next-line react/refs
  const frozenNowMs = frozenNowMsRef.current;

  return useMemo<TimeRange>(() => {
    if (startMs !== null && endMs !== null) {
      // closed range from context
      return { start: new Date(startMs), end: new Date(endMs) };
    } else if (startMs === null && endMs !== null) {
      return { start: new Date(endMs - ONE_MONTH_MS), end: new Date(endMs) };
    } else if (startMs !== null) {
      // If start is in the past, close at "now"; else, one month after start
      const closedEndMs =
        // eslint-disable-next-line react/refs
        startMs < frozenNowMs ? frozenNowMs : startMs + ONE_MONTH_MS;
      return { start: new Date(startMs), end: new Date(closedEndMs) };
    } else {
      // both null → last month to now
      return {
        start: new Date(frozenNowMs - ONE_MONTH_MS),
        end: new Date(frozenNowMs),
      };
    }
  }, [startMs, endMs, frozenNowMs]);
}
