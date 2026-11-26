import { intShortFormatter } from "@phoenix/utils/numberFormatUtils";

export type QueueThroughputRow = {
  timestamp: number;
  added: number;
  completed: number;
  queueSize: number;
};

export type QueueSizeRow = {
  timestamp: number;
  queueSize: number;
  processed: number;
};

type ActivityBin = {
  groups: ReadonlyArray<{
    evaluatedCount: number;
    failedCount: number;
    addedCount: number;
  }>;
};

type TimedActivityBin = ActivityBin & { timestamp: string };

/**
 * One throughput chart row per bin: what was added and completed in it, and
 * the queue size at its end, or 0 where that was not read.
 */
export function getQueueThroughputRows({
  bins,
  queueSizeByTimestamp,
}: {
  bins: ReadonlyArray<TimedActivityBin>;
  /** The queue size at each bin's end, keyed by the bin's start. */
  queueSizeByTimestamp: ReadonlyMap<number, number>;
}): QueueThroughputRow[] {
  return bins.map((bin) => {
    const timestamp = new Date(bin.timestamp).getTime();
    return {
      timestamp,
      added: getAddedCount(bin),
      completed: getCompletedCount(bin),
      queueSize: queueSizeByTimestamp.get(timestamp) ?? 0,
    };
  });
}

/**
 * One queue size chart row per bin: the queue size at its end, or 0 where
 * that was not read, and the evaluations completed in it.
 */
export function getQueueSizeRows({
  bins,
  queueSizeByTimestamp,
}: {
  bins: ReadonlyArray<TimedActivityBin>;
  /** The queue size at each bin's end, keyed by the bin's start. */
  queueSizeByTimestamp: ReadonlyMap<number, number>;
}): QueueSizeRow[] {
  return bins.map((bin) => {
    const timestamp = new Date(bin.timestamp).getTime();
    return {
      timestamp,
      queueSize: queueSizeByTimestamp.get(timestamp) ?? 0,
      processed: getCompletedCount(bin),
    };
  });
}

/** A bin's evaluations completed, evaluated or failed, across its groups. */
function getCompletedCount(bin: ActivityBin): number {
  return bin.groups.reduce(
    (sum, group) => sum + group.evaluatedCount + group.failedCount,
    0
  );
}

/** A bin's evaluations added to the queue, across its groups. */
function getAddedCount(bin: ActivityBin): number {
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
