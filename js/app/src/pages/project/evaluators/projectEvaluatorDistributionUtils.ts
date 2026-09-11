import type { AnnotationMetricsView } from "@phoenix/components/chart/annotationMetricsUtils";
import { formatFloat } from "@phoenix/utils/numberFormatUtils";

import type { ProjectEvaluatorCompareDistributions_comparison$data } from "./__generated__/ProjectEvaluatorCompareDistributions_comparison.graphql";

export type DistributionSide =
  ProjectEvaluatorCompareDistributions_comparison$data["sideA"];
export type DistributionChartRow = {
  label: string;
  count: number;
  lowerBound?: number | null;
  upperBound?: number | null;
  score?: number | null;
  description?: string;
};

export function getDistributionView({
  side,
  requested,
}: {
  side: DistributionSide;
  requested: string | null;
}): AnnotationMetricsView {
  const scores = side.scoreBinCounts ?? side.scoreValueCounts;
  const labels = side.labelCounts;
  if (requested === "labels" && labels) return "labels";
  if (requested === "scores" && scores) return "scores";
  return labels && side.threshold == null
    ? "labels"
    : scores
      ? "scores"
      : "labels";
}

export function getDistributionRows({
  side,
  view,
}: {
  side: DistributionSide;
  view: AnnotationMetricsView;
}): DistributionChartRow[] {
  if (view === "labels") {
    return (side.labelCounts ?? []).map((point) => ({
      ...point,
      label: point.isOther
        ? "Other labels (grouped)"
        : point.label || "(empty label)",
    }));
  }
  if (side.scoreValueCounts) {
    return side.scoreValueCounts.map((point) => ({
      ...point,
      label: String(point.score),
    }));
  }
  const edges = side.scoreBinEdges;
  const counts = side.scoreBinCounts;
  if (edges && counts) {
    return counts.map((count, index) => ({
      count,
      lowerBound: edges[index],
      upperBound: edges[index + 1],
      description: `${edges[index]} ≤ score ${index === counts.length - 1 ? "≤" : "<"} ${edges[index + 1]}`,
      label: `${formatFloat(edges[index])}–${formatFloat(edges[index + 1])}`,
    }));
  }
  return [];
}

export function getDistributionThresholdPosition({
  rows,
  threshold,
}: {
  rows: DistributionChartRow[];
  threshold: number | null;
}): number | null {
  if (threshold == null) return null;
  const index = rows.findIndex(
    (row) =>
      row.lowerBound != null &&
      row.upperBound != null &&
      threshold >= row.lowerBound &&
      threshold <= row.upperBound
  );
  const row = rows[index];
  if (
    !row ||
    row.lowerBound == null ||
    row.upperBound == null ||
    row.lowerBound >= row.upperBound
  )
    return null;
  return (
    index -
    0.5 +
    (threshold - row.lowerBound) / (row.upperBound - row.lowerBound)
  );
}
