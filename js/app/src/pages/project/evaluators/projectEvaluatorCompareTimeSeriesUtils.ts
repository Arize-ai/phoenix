import type { AnnotationOptimizationConfig } from "@phoenix/components/annotation";
import type { AnnotationLabelSegment } from "@phoenix/components/chart/AnnotationMetricsChart";
import type {
  AnnotationMetricsSeries,
  AnnotationMetricsView,
} from "@phoenix/components/chart/annotationMetricsUtils";

import {
  type EvaluatorCompareHue,
  getConfiguredScores,
  getRankedLabelShades,
  getShadeColor,
  getPositionalShades,
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
 * an optimization direction, labels shade best to worst and the best label
 * comes first, so the bottom of each stack is the share of good
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
  const shades =
    getRankedLabelShades({
      direction: config?.optimizationDirection,
      scores: ordered.map((label) => scoresByLabel.get(label)),
      referenceScores: getConfiguredScores(config),
    }) ?? getPositionalShades(ordered.length);
  const segments = ordered.map((label, order) => ({
    label,
    index: indexByLabel.get(label) ?? order,
    shade: shades[order] ?? null,
  }));
  // Stable, so equally shaded labels keep display order.
  segments.sort((left, right) => (right.shade ?? -1) - (left.shade ?? -1));
  return segments.map(({ label, index, shade }) => ({
    label,
    index,
    color: getShadeColor({ hue, shade }),
  }));
}

/**
 * The most bins the paired label bars stay full width at: two 10px bars and
 * the 1px gap between them need 21px per bin, and the chart sits in half a row.
 */
export const MAX_COMPARE_TIME_BINS = 20;
