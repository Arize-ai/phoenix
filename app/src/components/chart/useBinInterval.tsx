import { useMemo } from "react";

import { assertUnreachable } from "@phoenix/typeUtils";

const DEFAULT_MAX_TICK_COUNT = 8;

/**
 * Return the legacy fallback interval when the number of bins is unknown.
 */
function getFallbackBinInterval(scale: TimeBinScale): number {
  switch (scale) {
    case "YEAR":
      return 1;
    case "MONTH":
      return 1;
    case "WEEK":
    case "DAY":
      return 1;
    case "HOUR":
      return 1;
    case "MINUTE":
      return 5;
    default: {
      assertUnreachable(scale);
    }
  }
}

export function getBinInterval({
  scale,
  binCount,
  maxTickCount = DEFAULT_MAX_TICK_COUNT,
}: {
  scale: TimeBinScale;
  binCount?: number;
  maxTickCount?: number;
}): number {
  if (binCount == null || binCount <= 0) {
    return getFallbackBinInterval(scale);
  }
  const normalizedMaxTickCount = Math.max(1, maxTickCount);
  return Math.max(0, Math.ceil(binCount / normalizedMaxTickCount) - 1);
}

/**
 * A react hook that returns the interval between ticks for a time series chart.
 */
export function useBinInterval({
  scale,
  binCount,
  maxTickCount,
}: {
  scale: TimeBinScale;
  binCount?: number;
  maxTickCount?: number;
}): number {
  return useMemo(
    () => getBinInterval({ scale, binCount, maxTickCount }),
    [scale, binCount, maxTickCount]
  );
}
