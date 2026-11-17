import { intShortFormatter } from "@phoenix/utils/numberFormatUtils";

type ActivityBin = {
  groups: ReadonlyArray<{
    evaluatedCount: number;
    failedCount: number;
    addedCount: number;
  }>;
};

/** A bin's evaluations completed, evaluated or failed, across projects. */
export function getCompletedCount(bin: ActivityBin): number {
  return bin.groups.reduce(
    (sum, group) => sum + group.evaluatedCount + group.failedCount,
    0
  );
}

/** A bin's evaluations added to the queue, across projects. */
export function getAddedCount(bin: ActivityBin): number {
  return bin.groups.reduce((sum, group) => sum + group.addedCount, 0);
}

/** Added minus completed over the bins, or null without activity. */
export function getTotalNet(bins: ReadonlyArray<ActivityBin>): number | null {
  let hasActivity = false;
  let totalNet = 0;
  for (const bin of bins) {
    const added = getAddedCount(bin);
    const completed = getCompletedCount(bin);
    hasActivity ||= added > 0 || completed > 0;
    totalNet += added - completed;
  }
  return hasActivity ? totalNet : null;
}

/** The range's net change as a sentence, or nothing without activity. */
export function formatQueueGrowthSummary(
  totalNet: number | null
): string | undefined {
  if (totalNet == null) {
    return undefined;
  }
  if (totalNet > 0) {
    return `Queue grew by ${intShortFormatter(totalNet)} in this range`;
  }
  if (totalNet < 0) {
    return `Queue shrank by ${intShortFormatter(-totalNet)} in this range`;
  }
  return "Queue kept pace in this range";
}

/** The smallest 1, 2, or 5 times a power of ten at or above `value`. */
function getNiceCeiling(value: number): number {
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 5, 10].find((multiple) => multiple * magnitude >= value);
  return (step ?? 10) * magnitude;
}

/**
 * A count axis mirrored around zero: the same extent above and below, so both
 * halves read on one scale, with whole-number ticks only.
 */
export function getMirroredCountAxis(maxCount: number): {
  extent: number;
  ticks: number[];
} {
  const extent = getNiceCeiling(Math.max(1, maxCount));
  const half = extent / 2;
  const ticks = Number.isInteger(half)
    ? [-extent, -half, 0, half, extent]
    : [-extent, 0, extent];
  return { extent, ticks };
}
