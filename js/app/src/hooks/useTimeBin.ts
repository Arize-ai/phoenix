import { useMemo } from "react";

import {
  ONE_DAY_MS,
  ONE_DAY_SEC,
  ONE_HOUR_MS,
  ONE_HOUR_SEC,
  ONE_MINUTE_MS,
  ONE_MONTH_SEC,
  ONE_WEEK_MS,
  ONE_WEEK_SEC,
  ONE_YEAR_SEC,
} from "@phoenix/constants/timeConstants";

/**
 * Given a time range, returns the appropriate time bin scale to use for
 * charting. Pure form of {@link useTimeBinScale} for code that runs outside
 * React (e.g. route loaders).
 */
export function getTimeBinScale({
  timeRange,
}: {
  timeRange: OpenTimeRange;
}): TimeBinScale {
  const startTime = timeRange.start;
  let scale: TimeBinScale = "DAY"; // TODO: Does this make sense
  if (startTime) {
    const endTime = timeRange.end || new Date();
    const duration = (endTime.getTime() - startTime.getTime()) / 1000; // in seconds
    if (duration > 5 * ONE_YEAR_SEC) {
      scale = "YEAR";
    } else if (duration > 5 * ONE_MONTH_SEC) {
      scale = "MONTH";
    } else if (duration > 5 * ONE_WEEK_SEC) {
      scale = "WEEK";
    } else if (duration > 5 * ONE_DAY_SEC) {
      scale = "DAY";
    } else if (duration > 5 * ONE_HOUR_SEC) {
      scale = "HOUR";
    } else {
      scale = "MINUTE";
    }
  }
  return scale;
}

/**
 * Given a time range, returns the appropriate time bin scale to use. Used for charting.
 */
export function useTimeBinScale({
  timeRange,
}: {
  timeRange: OpenTimeRange;
}): TimeBinScale {
  return useMemo(() => getTimeBinScale({ timeRange }), [timeRange]);
}

/**
 * A bin width of `interval` × `scale`, as sent in `TimeBinConfig`.
 */
export type TimeBinSpec = {
  scale: TimeBinScale;
  interval: number;
};

/**
 * Natural multiples of each scale, smallest first.
 */
const TIME_BIN_INTERVALS: Record<TimeBinScale, ReadonlyArray<number>> = {
  MINUTE: [1, 2, 5, 10, 15, 30],
  HOUR: [1, 2, 3, 6, 12],
  DAY: [1, 2],
  WEEK: [1, 2, 4],
  MONTH: [1],
  YEAR: [1],
};

const FIXED_TIME_BIN_SCALE_MS: Partial<Record<TimeBinScale, number>> = {
  MINUTE: ONE_MINUTE_MS,
  HOUR: ONE_HOUR_MS,
  DAY: ONE_DAY_MS,
  WEEK: ONE_WEEK_MS,
};

/**
 * Picks the scale from {@link getTimeBinScale} and the smallest interval that
 * keeps the range within `maxBins` bins, or the largest interval if none does.
 */
export function getTimeBinSpec({
  timeRange,
  maxBins,
}: {
  timeRange: OpenTimeRange;
  maxBins: number;
}): TimeBinSpec {
  const scale = getTimeBinScale({ timeRange });
  const scaleMs = FIXED_TIME_BIN_SCALE_MS[scale];
  if (scaleMs == null || timeRange.start == null) {
    return { scale, interval: 1 };
  }
  const endTime = timeRange.end ?? new Date();
  const binCount = Math.ceil(
    (endTime.getTime() - timeRange.start.getTime()) / scaleMs
  );
  const intervals = TIME_BIN_INTERVALS[scale];
  const interval =
    intervals.find((candidate) => Math.ceil(binCount / candidate) <= maxBins) ??
    intervals[intervals.length - 1] ??
    1;
  return { scale, interval };
}

/**
 * Hook form of {@link getTimeBinSpec}.
 */
export function useTimeBinSpec({
  timeRange,
  maxBins,
}: {
  timeRange: OpenTimeRange;
  maxBins: number;
}): TimeBinSpec {
  return useMemo(
    () => getTimeBinSpec({ timeRange, maxBins }),
    [timeRange, maxBins]
  );
}
