import type { OpenTimeRangeWithKey } from "@phoenix/components/datetime";
import {
  clampTimeRangeToMaxDuration,
  getLastNTimeRangeKeyFromDurationMs,
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
  /** The page time range clamped to the score window cap, as ISO strings. */
  timeRange: { start: string; end: string };
  timeBinConfig: { scale: TimeBinScale; utcOffsetMinutes: number };
  /** Compact label of the window length, e.g. "7d". */
  windowKey: string;
};

/**
 * Resolves the page time range into the mean score column's closed, clamped
 * window. Everything derives from the range's snapped bounds so the loader
 * and the table produce identical query variables (see the loader's note on
 * snapping).
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
  const clamped = clampTimeRangeToMaxDuration({
    value: timeRange,
    maxDurationMs: MAX_SCORE_WINDOW_MS,
    now,
  });
  const durationMs = clamped.end.getTime() - clamped.start.getTime();
  // An unclamped last-N range echoes its own key ("1d"), since the resolved
  // duration overshoots the label a little (last-N starts snap backward) and
  // would otherwise format as e.g. "25h". Clamped and custom ranges derive
  // the label from the actual window.
  const isClamped =
    timeRange.start == null ||
    clamped.start.getTime() > timeRange.start.getTime();
  return {
    timeRange: {
      start: clamped.start.toISOString(),
      end: clamped.end.toISOString(),
    },
    timeBinConfig: {
      scale: getTimeBinScale({ timeRange: clamped }),
      utcOffsetMinutes,
    },
    windowKey:
      !isClamped && timeRange.timeRangeKey !== "custom"
        ? timeRange.timeRangeKey
        : getLastNTimeRangeKeyFromDurationMs(durationMs),
  };
}
