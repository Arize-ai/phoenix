import type { OpenTimeRangeWithKey } from "@phoenix/components/datetime";
import type { LastNTimeRangeKey } from "@phoenix/components/datetime/types";
import {
  clampTimeRangeToMaxDuration,
  getDurationMsFromLastNTimeRangeKey,
  getLastNTimeRangeKeyFromDurationMs,
  getTimeRangeFromLastNTimeRangeKey,
  isLastNTimeRangeKey,
} from "@phoenix/components/datetime/utils";
import {
  ONE_DAY_MS,
  ONE_HOUR_MS,
  ONE_MINUTE_MS,
} from "@phoenix/constants/timeConstants";
import { getTimeBinScale } from "@phoenix/hooks/useTimeBin";

/**
 * The results column aggregates over at most this much of the page time
 * range, keeping the per-page annotation scans bounded on long ranges.
 */
export const MAX_SCORE_WINDOW_MS = 30 * ONE_DAY_MS;

/** The live last-N key that spans exactly {@link MAX_SCORE_WINDOW_MS}. */
const MAX_SCORE_WINDOW_KEY: LastNTimeRangeKey = "30d";

/**
 * The window and binning the results column aggregates over. Derived from
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
 * Whether two score windows would produce identical query variables. Compares
 * every field so the table's initial-fetch guard can't silently drift from
 * whatever the loader derived.
 */
export function isSameEvaluatorScoreWindow(
  a: EvaluatorScoreWindow,
  b: EvaluatorScoreWindow
): boolean {
  return (
    a.timeRange.start === b.timeRange.start &&
    a.timeRange.end === b.timeRange.end &&
    a.previousTimeRange.start === b.previousTimeRange.start &&
    a.previousTimeRange.end === b.previousTimeRange.end &&
    a.timeBinConfig.scale === b.timeBinConfig.scale &&
    a.timeBinConfig.utcOffsetMinutes === b.timeBinConfig.utcOffsetMinutes &&
    a.windowKey === b.windowKey
  );
}

/**
 * Resolves the page time range into the results column's clamped window.
 * A live last-N range derives everything from its key and its snapped start,
 * never from "now", so the loader and the table produce identical query
 * variables and repeated derivations stay cache-friendly. A live range longer
 * than the cap becomes the live "30d" range, so the two share variables.
 * Custom ranges are closed over the page range, clamped to the cap.
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
  if (isLastNTimeRangeKey(timeRangeKey) && timeRange.end == null) {
    const isOverCap =
      getDurationMsFromLastNTimeRangeKey(timeRangeKey) > MAX_SCORE_WINDOW_MS;
    const key = isOverCap ? MAX_SCORE_WINDOW_KEY : timeRangeKey;
    const start = isOverCap
      ? getTimeRangeFromLastNTimeRangeKey(key, now.getTime()).start
      : timeRange.start;
    if (start != null) {
      return getLiveScoreWindow({ key, start, utcOffsetMinutes });
    }
  }
  const clamped = clampTimeRangeToMaxDuration({
    value: timeRange,
    maxDurationMs: MAX_SCORE_WINDOW_MS,
    now,
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

/**
 * A live last-N window within the cap: the end stays open ("up to now") and
 * the previous window mirrors the key's exact duration backward from the
 * start, which the time range provider has already snapped.
 */
function getLiveScoreWindow({
  key,
  start,
  utcOffsetMinutes,
}: {
  key: LastNTimeRangeKey;
  start: Date;
  utcOffsetMinutes: number;
}): EvaluatorScoreWindow {
  const keyDurationMs = getDurationMsFromLastNTimeRangeKey(key);
  // The live window runs past the key's duration by its start's snap-back:
  // under a minute for keys up to an hour, under an hour beyond. Choose the
  // bin scale for the window just before the next snap, as the page's charts
  // see it for nearly the whole interval (a "5h" key bins by the hour).
  const snapMs = keyDurationMs <= ONE_HOUR_MS ? ONE_MINUTE_MS : ONE_HOUR_MS;
  const startIso = start.toISOString();
  return {
    timeRange: { start: startIso },
    previousTimeRange: {
      start: new Date(start.getTime() - keyDurationMs).toISOString(),
      end: startIso,
    },
    timeBinConfig: {
      scale: getTimeBinScale({
        timeRange: {
          start,
          end: new Date(start.getTime() + keyDurationMs + snapMs),
        },
      }),
      utcOffsetMinutes,
    },
    windowKey: key,
  };
}
