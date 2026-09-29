import type { AnnotationOptimizationConfig } from "@phoenix/components/annotation";
import type { AnnotationLabelSegment } from "@phoenix/components/chart/AnnotationMetricsChart";
import type {
  AnnotationMetricsSeries,
  AnnotationMetricsView,
} from "@phoenix/components/chart/annotationMetricsUtils";

import {
  type EvaluatorCompareHue,
  getConfiguredScores,
  getLabelOptimalities,
  getLabelOptimalityColor,
  getPositionalOptimalities,
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
 * Colors one evaluator's labels for a stacked bar in shades of its hue. With
 * an optimization direction, shades follow optimality and the most optimal
 * label comes first, so the bottom of each stack is the share of good
 * results. Without one, labels step through the same shades in display order.
 */
export function getCompareLabelSegments({
  labels,
  hue,
  config,
}: {
  /** The side's series labels; segment indexes point into this array. */
  labels: ReadonlyArray<string>;
  hue: EvaluatorCompareHue;
  config: AnnotationOptimizationConfig | undefined;
}): AnnotationLabelSegment[] {
  const scoresByLabel = new Map(
    (config?.values ?? []).map(({ label, score }) => [label ?? "", score])
  );
  const indexByLabel = new Map(labels.map((label, index) => [label, index]));
  const ordered = getLabelDisplayOrder({
    labels,
    configuredLabels: Array.from(scoresByLabel.keys()),
  });
  const optimalities =
    getLabelOptimalities({
      direction: config?.optimizationDirection,
      scores: ordered.map((label) => scoresByLabel.get(label)),
      referenceScores: getConfiguredScores(config),
    }) ?? getPositionalOptimalities(ordered.length);
  const segments = ordered.map((label, order) => ({
    label,
    index: indexByLabel.get(label) ?? order,
    optimality: optimalities[order] ?? null,
  }));
  // Stable, so equally optimal labels keep display order.
  segments.sort(
    (left, right) => (right.optimality ?? -1) - (left.optimality ?? -1)
  );
  return segments.map(({ label, index, optimality }) => ({
    label,
    index,
    color: getLabelOptimalityColor({ hue, optimality }),
  }));
}
