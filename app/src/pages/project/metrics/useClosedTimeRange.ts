import { useMemo, useRef } from "react";

import { useTimeRange } from "@phoenix/components";
import { ONE_MONTH_MS } from "@phoenix/constants/timeConstants";

export type EpochTimeRange = {
  start: number;
  end: number;
};

/**
 * Hook that converts an open time range from context into a closed time range.
 * If the time range is already closed, it returns it as-is.
 * If it's open, it fills in missing start/end values based on a frozen "now" timestamp.
 *
 * The "now" timestamp is frozen and only updates when the context time range
 * actually changes (or when refreshKey changes), preventing unnecessary
 * recalculations on every render.
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
} = {}): EpochTimeRange {
  const { timeRange: contextTimeRange } = useTimeRange();

  // Extract and memoize timestamps to get stable primitive values
  const startMs = useMemo(
    () => (contextTimeRange.start ? contextTimeRange.start.getTime() : null),
    [contextTimeRange.start]
  );
  const endMs = useMemo(
    () => (contextTimeRange.end ? contextTimeRange.end.getTime() : null),
    [contextTimeRange.end]
  );

  // Use a ref to freeze "now" until the context time range actually changes
  const lastTimestampsRef = useRef({ startMs, endMs, refreshKey });
  // eslint-disable-next-line react-hooks/purity
  const frozenNowMsRef = useRef<number>(Date.now());

  // Only update frozen "now" when the timestamps or refresh key actually change
  if (
    lastTimestampsRef.current.startMs !== startMs ||
    lastTimestampsRef.current.endMs !== endMs ||
    lastTimestampsRef.current.refreshKey !== refreshKey
  ) {
    lastTimestampsRef.current = { startMs, endMs, refreshKey };
    // eslint-disable-next-line react-hooks/purity
    frozenNowMsRef.current = Date.now();
  }

  const frozenNowMs = frozenNowMsRef.current;

  const epochTimeRange = useMemo<EpochTimeRange>(() => {
    let start = startMs;
    let end = endMs;
    if (start !== null && end !== null) {
      // closed range from context
      return { start, end };
    } else if (start === null && end !== null) {
      return { start: end - ONE_MONTH_MS, end };
    } else if (start !== null && end === null) {
      // If start is in the past, close at "now"; else, one month after start
      end = start < frozenNowMs ? frozenNowMs : start + ONE_MONTH_MS;
      return { start, end };
    } else {
      // both null → last month to now
      end = frozenNowMs;
      start = end - ONE_MONTH_MS;
      return { start, end };
    }
  }, [startMs, endMs, frozenNowMs]);

  return epochTimeRange;
}
