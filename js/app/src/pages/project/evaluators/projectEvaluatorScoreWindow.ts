import { startOfHour } from "date-fns";

import type { OpenTimeRangeWithKey } from "@phoenix/components/datetime";
import {
  clampTimeRangeToMaxDuration,
  getDurationMsFromLastNTimeRangeKey,
  getLastNTimeRangeKeyFromDurationMs,
  isLastNTimeRangeKey,
} from "@phoenix/components/datetime/utils";
import { ONE_DAY_MS } from "@phoenix/constants/timeConstants";
import { getTimeBinScale } from "@phoenix/hooks/useTimeBin";

/**
 * The mean score column aggregates over at most this much of the page time
 * range, keeping the per-page annotation scans bounded on long ranges.
 */
export const MAX_SCORE_WINDOW_MS = 30 * ONE_DAY_MS;

/**
 * The window and binning the mean score column aggregates over. Derived from
 * the page time range by the route loader and by the table (for refetches),
 * which must agree exactly so a fresh mount reuses the loader's response.
 */
export type EvaluatorScoreWindow = {
  /**
   * The window the scores cover, as ISO strings. A live page range leaves the
   * end open ("up to now", resolved by the server) so the query variables —
   * and with them the server's dataloader cache keys — stay stable between
   * the range's snap boundaries instead of changing every render.
   */
  timeRange: { start: string; end?: string };
  /** The equal-length window immediately before, for the delta. */
  previousTimeRange: { start: string; end: string };
  timeBinConfig: { scale: TimeBinScale; utcOffsetMinutes: number };
  /** Compact label of the window length, e.g. "7d". */
  windowKey: string;
};

/**
 * Resolves the page time range into the mean score column's clamped window.
 * Everything derives from the range's snapped bounds and its last-N key —
 * never from "now" — so the loader and the table produce identical query
 * variables and repeated derivations stay cache-friendly. The one exception
 * is a live range longer than the cap, whose trailing window must resolve
 * "now"; it snaps to the hour so it, too, holds still between snaps.
 */
export function getEvaluatorScoreWindow({
  timeRange,
  utcOffsetMinutes,
  now = new Date(),
}: {
  timeRange: OpenTimeRangeWithKey;
  utcOffsetMinutes: number;
  /** Reference "now" for resolving open-ended ranges. Defaults to the current time. */
  now?: Date;
}): EvaluatorScoreWindow {
  const { timeRangeKey } = timeRange;
  const keyDurationMs = isLastNTimeRangeKey(timeRangeKey)
    ? getDurationMsFromLastNTimeRangeKey(timeRangeKey)
    : null;
  if (
    keyDurationMs != null &&
    keyDurationMs <= MAX_SCORE_WINDOW_MS &&
    timeRange.start != null &&
    timeRange.end == null
  ) {
    // A live last-N range within the cap: keep the end open and mirror the
    // key's exact duration backward for the previous window. The start is
    // already snapped by the provider, so no field here depends on "now" —
    // including the bin scale, derived from the key's duration.
    const startIso = timeRange.start.toISOString();
    return {
      timeRange: { start: startIso },
      previousTimeRange: {
        start: new Date(
          timeRange.start.getTime() - keyDurationMs
        ).toISOString(),
        end: startIso,
      },
      timeBinConfig: {
        scale: getTimeBinScale({
          timeRange: {
            start: timeRange.start,
            end: new Date(timeRange.start.getTime() + keyDurationMs),
          },
        }),
        utcOffsetMinutes,
      },
      windowKey: timeRangeKey,
    };
  }
  // Custom ranges are closed by nature; a live range over the cap clamps to
  // its trailing 30 days, resolving "now" snapped to the hour for stability.
  const clamped = clampTimeRangeToMaxDuration({
    value: timeRange,
    maxDurationMs: MAX_SCORE_WINDOW_MS,
    now: startOfHour(now),
  });
  const durationMs = clamped.end.getTime() - clamped.start.getTime();
  return {
    timeRange: {
      start: clamped.start.toISOString(),
      end: clamped.end.toISOString(),
    },
    previousTimeRange: {
      start: new Date(clamped.start.getTime() - durationMs).toISOString(),
      end: clamped.start.toISOString(),
    },
    timeBinConfig: {
      scale: getTimeBinScale({ timeRange: clamped }),
      utcOffsetMinutes,
    },
    windowKey: getLastNTimeRangeKeyFromDurationMs(durationMs),
  };
}
