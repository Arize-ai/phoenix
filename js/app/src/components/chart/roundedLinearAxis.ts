/**
 * Step multipliers that land a linear axis's ticks on round numbers, per power of ten.
 */
const ROUND_STEP_MULTIPLIERS = [1, 2, 2.5, 5, 10] as const;

/**
 * The most intervals (gaps between ticks) a compact chart's y axis shows.
 */
const DEFAULT_MAX_INTERVAL_COUNT = 5;

export type RoundedLinearAxis = {
  domain: [number, number];
  ticks: number[];
};

/**
 * Computes a zero-based linear axis whose bounds snap to the nearest round tick
 * beyond the data.
 *
 * Recharts' default `tickCount` forces an exact number of ticks, which inflates
 * the step (e.g. a max of 4.2 gets 0, 2, 4, 6, 8) and leaves the tallest bar at
 * half height. Letting the tick count flex keeps the data filling the plot.
 * Zero is always included so bar lengths stay proportional to their values.
 */
export function getRoundedLinearAxis({
  values,
  maxIntervalCount = DEFAULT_MAX_INTERVAL_COUNT,
}: {
  values: ReadonlyArray<number>;
  maxIntervalCount?: number;
}): RoundedLinearAxis | undefined {
  const finiteValues = values.filter(Number.isFinite);
  if (finiteValues.length === 0) {
    return undefined;
  }
  const min = Math.min(0, ...finiteValues);
  const max = Math.max(0, ...finiteValues);
  if (min === max) {
    return undefined;
  }
  let step = getRoundStep((max - min) / maxIntervalCount);
  let roundedMin = Math.floor(min / step) * step;
  let roundedMax = Math.ceil(max / step) * step;
  // Snapping both ends outward can add an interval when the data spans zero
  while (Math.round((roundedMax - roundedMin) / step) > maxIntervalCount) {
    step = getRoundStep(step * 1.000001);
    roundedMin = Math.floor(min / step) * step;
    roundedMax = Math.ceil(max / step) * step;
  }
  const intervalCount = Math.round((roundedMax - roundedMin) / step);
  const ticks = Array.from({ length: intervalCount + 1 }, (_, index) =>
    // Round away floating point drift such as 0.30000000000000004
    Number((roundedMin + index * step).toPrecision(12))
  );
  return { domain: [ticks[0], ticks[ticks.length - 1]], ticks };
}

/**
 * The smallest round step that is at least `minStep`
 */
function getRoundStep(minStep: number): number {
  const magnitude = 10 ** Math.floor(Math.log10(minStep));
  const multiplier =
    ROUND_STEP_MULTIPLIERS.find(
      (multiplier) => multiplier * magnitude >= minStep
    ) ?? 10;
  return multiplier * magnitude;
}
