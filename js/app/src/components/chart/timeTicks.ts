const DEFAULT_TIME_TICK_COUNT = 6;
const MIN_TIME_TICK_COUNT = 2;

/**
 * Calculates how many time-axis ticks can fit in a chart at the desired spacing.
 * @param params - tick count parameters
 * @param params.width - chart width in pixels
 * @param params.minSpacing - minimum spacing between tick labels in pixels
 * @param params.fallbackCount - tick count to use before the chart is measured
 */
export function getMaxTimeTickCount({
  width,
  minSpacing,
  fallbackCount = DEFAULT_TIME_TICK_COUNT,
}: {
  width: number | null | undefined;
  minSpacing: number;
  fallbackCount?: number;
}) {
  if (width == null || !Number.isFinite(width) || width <= 0) {
    return fallbackCount;
  }
  return Math.max(MIN_TIME_TICK_COUNT, Math.floor(width / minSpacing) + 1);
}

/**
 * Selects a sorted, evenly spaced subset of timestamps.
 * @param params - tick selection parameters
 * @param params.timestamps - candidate timestamps in epoch milliseconds
 * @param params.maxTickCount - maximum number of visible ticks
 */
export function getEvenlySpacedTimeTicks({
  timestamps,
  maxTickCount,
}: {
  timestamps: readonly number[];
  maxTickCount: number;
}) {
  const sortedTimestamps = Array.from(
    new Set(timestamps.filter((timestamp) => Number.isFinite(timestamp)))
  ).sort((leftTimestamp, rightTimestamp) => leftTimestamp - rightTimestamp);
  const normalizedMaxTickCount = Math.max(
    MIN_TIME_TICK_COUNT,
    Math.floor(maxTickCount)
  );
  if (sortedTimestamps.length <= normalizedMaxTickCount) {
    return sortedTimestamps;
  }

  const tickStep = Math.ceil(sortedTimestamps.length / normalizedMaxTickCount);
  const ticks: number[] = [];
  for (let index = 0; index < sortedTimestamps.length; index += tickStep) {
    ticks.push(sortedTimestamps[index]!);
  }
  return ticks;
}

/**
 * Selects time-axis ticks that fit the measured chart width.
 * @param params - tick selection parameters
 * @param params.timestamps - candidate timestamps in epoch milliseconds
 * @param params.width - chart width in pixels
 * @param params.minSpacing - minimum spacing between tick labels in pixels
 * @param params.fallbackCount - tick count to use before the chart is measured
 */
export function getTimeAxisTicks({
  timestamps,
  width,
  minSpacing,
  fallbackCount,
}: {
  timestamps: readonly number[];
  width: number | null | undefined;
  minSpacing: number;
  fallbackCount?: number;
}) {
  const maxTickCount = getMaxTimeTickCount({
    width,
    minSpacing,
    fallbackCount,
  });
  return getEvenlySpacedTimeTicks({
    timestamps,
    maxTickCount,
  });
}
