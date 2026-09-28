import type { AnnotationLabelSegment } from "@phoenix/components/chart/AnnotationMetricsChart";
import type {
  AnnotationMetricsInputPoint,
  AnnotationMetricsSeries,
  AnnotationMetricsView,
  AnnotationSummary,
} from "@phoenix/components/chart/annotationMetricsUtils";
import {
  getCategoryChartColor,
  type useCategoryChartColors,
} from "@phoenix/components/chart/colors";
import {
  ONE_DAY_MS,
  ONE_HOUR_MS,
  ONE_MINUTE_MS,
} from "@phoenix/constants/timeConstants";

import {
  getLabelOptimalities,
  getLabelOptimalityColor,
} from "./projectEvaluatorCompareUtils";

/** The views either evaluator can show, scores first. */
export function getCompareTimeSeriesViews(
  series: ReadonlyArray<AnnotationMetricsSeries | undefined>
): AnnotationMetricsView[] {
  const views = new Set(series.flatMap((side) => side?.views ?? []));
  return (["scores", "labels"] as const).filter((view) => views.has(view));
}

export function getCompareTimeSeriesView({
  views,
  requested,
}: {
  views: ReadonlyArray<AnnotationMetricsView>;
  requested: string | null;
}): AnnotationMetricsView {
  if (requested === "labels" || requested === "scores") {
    if (views.includes(requested)) return requested;
  }
  return views[0] ?? "scores";
}

/**
 * Orders labels the way distributions list them: configured order first, then
 * alphabetically. Charts that color labels by position share this order so a
 * label keeps its color from one chart to the next.
 */
export function getLabelDisplayOrder({
  labels,
  configuredLabels,
}: {
  labels: ReadonlyArray<string>;
  configuredLabels: ReadonlyArray<string>;
}): string[] {
  const configuredIndex = new Map(
    configuredLabels.map((label, index) => [label, index])
  );
  return [...labels].sort((left, right) => {
    const leftIndex = configuredIndex.get(left) ?? Infinity;
    const rightIndex = configuredIndex.get(right) ?? Infinity;
    return leftIndex !== rightIndex
      ? leftIndex - rightIndex
      : left.localeCompare(right);
  });
}

/**
 * Colors one evaluator's labels for a stacked bar. With an optimization
 * direction, labels are shades of the evaluator color by optimality, most
 * optimal first, so the bottom of each stack is the share of good results.
 * Without one, labels take the categorical palette in display order, as label
 * distributions do elsewhere.
 */
export function getCompareLabelSegments({
  labels,
  color,
  direction,
  scoresByLabel,
  categoryColors,
}: {
  /** The side's series labels; segment indexes point into this array. */
  labels: ReadonlyArray<string>;
  color: string;
  direction: string | null | undefined;
  /** Configured labels in configured order, with their mapped scores. */
  scoresByLabel: ReadonlyMap<string, number | null>;
  categoryColors: ReturnType<typeof useCategoryChartColors>;
}): {
  segments: AnnotationLabelSegment[];
  hasOptimization: boolean;
} {
  const indexByLabel = new Map(labels.map((label, index) => [label, index]));
  const ordered = getLabelDisplayOrder({
    labels,
    configuredLabels: Array.from(scoresByLabel.keys()),
  });
  const optimalities = getLabelOptimalities({
    direction,
    scores: ordered.map((label) => scoresByLabel.get(label)),
    referenceScores: Array.from(scoresByLabel.values()),
  });
  if (optimalities == null) {
    return {
      hasOptimization: false,
      segments: ordered.map((label, order) => ({
        label,
        index: indexByLabel.get(label) ?? order,
        color: getCategoryChartColor({ index: order, colors: categoryColors }),
      })),
    };
  }
  const segments = ordered.map((label, order) => ({
    label,
    index: indexByLabel.get(label) ?? order,
    optimality: optimalities[order] ?? null,
  }));
  // Stable, so equally optimal labels keep display order.
  segments.sort(
    (left, right) => (right.optimality ?? -1) - (left.optimality ?? -1)
  );
  return {
    hasOptimization: true,
    segments: segments.map(({ label, index, optimality }) => ({
      label,
      index,
      color: getLabelOptimalityColor({ color, optimality }),
    })),
  };
}

/**
 * The most bins the paired label bars stay full width at: two 10px bars per
 * bin need about 21px, and the chart sits in half a row.
 */
export const MAX_COMPARE_TIME_BINS = 20;

/** Whole multiples of each server bin that read as natural clock intervals. */
const BIN_FACTORS: Record<TimeBinScale, ReadonlyArray<number>> = {
  MINUTE: [1, 2, 5, 10, 15, 30, 60],
  HOUR: [1, 2, 3, 6, 12, 24],
  DAY: [1, 2, 7],
  WEEK: [1, 2, 4],
  MONTH: [1, 3, 6, 12],
  YEAR: [1, 2, 5, 10],
};

/** Units that are one fixed length, so merged bins can align to clock time. */
const FIXED_BIN_MS: Partial<Record<TimeBinScale, number>> = {
  MINUTE: ONE_MINUTE_MS,
  HOUR: ONE_HOUR_MS,
  DAY: ONE_DAY_MS,
};

type SummaryBin = {
  readonly timestamp: string;
  readonly annotationSummaries: ReadonlyArray<{
    readonly name: string;
    readonly count: number;
    readonly scoreCount: number;
    readonly meanScore: number | null;
    readonly labelFractions: ReadonlyArray<{
      readonly label: string;
      readonly fraction: number;
    }>;
  }>;
};

export type MergedSummaryBins = {
  readonly points: AnnotationMetricsInputPoint[];
  /** Length of each merged bin, when the unit has a fixed length. */
  readonly binMs: number | null;
};

/**
 * Merges runs of adjacent server bins so a range yields at most `maxBins`
 * bins, picking the smallest natural multiple that fits (last hour's 60
 * minute bins become twelve 5-minute bins). Fixed-length units align merged
 * bins to local clock boundaries; weeks, months, and years group from the
 * first bin.
 *
 * Label shares are weighted by each bin's result count and mean scores by its
 * scored count. The server averages both over targets, so a merged bin is
 * exact when each target has one result per evaluator in it, and close
 * otherwise.
 */
export function mergeSummaryBins({
  bins,
  scale,
  utcOffsetMinutes,
  maxBins = MAX_COMPARE_TIME_BINS,
}: {
  bins: ReadonlyArray<SummaryBin>;
  scale: TimeBinScale;
  utcOffsetMinutes: number;
  maxBins?: number;
}): MergedSummaryBins {
  const factors = BIN_FACTORS[scale];
  const factor =
    factors.find(
      (candidate) => Math.ceil(bins.length / candidate) <= maxBins
    ) ??
    factors[factors.length - 1] ??
    1;
  const unitMs = FIXED_BIN_MS[scale];
  const binMs = unitMs == null ? null : unitMs * factor;
  const offsetMs = utcOffsetMinutes * ONE_MINUTE_MS;
  const sorted = [...bins]
    .map((bin) => ({ ...bin, x: new Date(bin.timestamp).getTime() }))
    .sort((left, right) => left.x - right.x);
  const groups = new Map<number, (typeof sorted)[number][]>();
  sorted.forEach((bin, index) => {
    const start =
      binMs == null
        ? (sorted[index - (index % factor)]?.x ?? bin.x)
        : Math.floor((bin.x + offsetMs) / binMs) * binMs - offsetMs;
    groups.set(start, [...(groups.get(start) ?? []), bin]);
  });
  return {
    binMs,
    points: Array.from(groups, ([x, members]) => ({
      x,
      summaries: mergeSummaries(
        members.flatMap((member) => member.annotationSummaries)
      ),
    })),
  };
}

function mergeSummaries(
  summaries: SummaryBin["annotationSummaries"]
): AnnotationSummary[] {
  const byName = new Map<string, SummaryBin["annotationSummaries"][number][]>();
  for (const summary of summaries) {
    byName.set(summary.name, [...(byName.get(summary.name) ?? []), summary]);
  }
  return Array.from(byName, ([name, group]) => {
    const count = group.reduce((total, { count }) => total + count, 0);
    const scored = group.filter(
      ({ meanScore, scoreCount }) => meanScore != null && scoreCount > 0
    );
    const scoreCount = scored.reduce(
      (total, { scoreCount }) => total + scoreCount,
      0
    );
    const labelWeights = new Map<string, number>();
    for (const summary of group) {
      for (const { label, fraction } of summary.labelFractions) {
        labelWeights.set(
          label,
          (labelWeights.get(label) ?? 0) + fraction * summary.count
        );
      }
    }
    return {
      name,
      meanScore:
        scoreCount === 0
          ? null
          : scored.reduce(
              (total, { meanScore, scoreCount }) =>
                total + (meanScore ?? 0) * scoreCount,
              0
            ) / scoreCount,
      labelFractions:
        count === 0
          ? []
          : Array.from(labelWeights, ([label, weight]) => ({
              label,
              fraction: weight / count,
            })),
    };
  });
}
