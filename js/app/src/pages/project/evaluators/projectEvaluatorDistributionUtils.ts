import type { AnnotationMetricsView } from "@phoenix/components/chart/annotationMetricsUtils";
import { formatFloat } from "@phoenix/utils/numberFormatUtils";

import type { ProjectEvaluatorCompareDistributions_side$data } from "./__generated__/ProjectEvaluatorCompareDistributions_side.graphql";
import { getRankedLabelShades } from "./projectEvaluatorCompareUtils";

export type DistributionSide = Omit<
  ProjectEvaluatorCompareDistributions_side$data,
  " $fragmentType"
>;
/** Which targets a distribution covers: those both evaluators scored, or every one each scored. */
export type DistributionScope = "overlap" | "all";

/**
 * Overlap by default, since Agreement and Coverage describe the same shared
 * targets. Falls back to all when nothing overlaps, where the overlap choice
 * is unavailable and would only chart empty distributions.
 */
export function getDistributionScope({
  requested,
  evaluatedByBoth,
}: {
  requested: string | null;
  evaluatedByBoth: number;
}): DistributionScope {
  if (evaluatedByBoth === 0) return "all";
  return requested === "all" ? "all" : "overlap";
}

/**
 * A score for display: `formatFloat`'s precision and floating-point cleanup
 * (at most two decimals), without padding zeros, so exact values read "1",
 * "0.5", or "65.74".
 */
export function formatScoreValue(score: number): string {
  const formatted = formatFloat(score);
  return formatted.includes(".") && !/[a-z]/i.test(formatted)
    ? formatted.replace(/\.?0+$/, "")
    : formatted;
}

export type DistributionChartRow = {
  label: string;
  count: number;
  isOther?: boolean;
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
      label: formatScoreValue(point.score),
    }));
  }
  const edges = side.scoreBinEdges;
  const counts = side.scoreBinCounts;
  if (edges && counts) {
    return counts.map((count, index) => ({
      count,
      lowerBound: edges[index],
      upperBound: edges[index + 1],
      description: `${formatScoreValue(edges[index])} ≤ score ${index === counts.length - 1 ? "≤" : "<"} ${formatScoreValue(edges[index + 1])}`,
      label: `${formatScoreValue(edges[index])}–${formatScoreValue(edges[index + 1])}`,
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

/**
 * Puts label rows best first, by mapped score and optimization
 * direction, so every evaluator's bars read best to worst from the left.
 * Unscored labels and the grouped Other row follow in their original order.
 * Without a direction the rows keep their order (configured, then
 * alphabetical) and shades are null.
 */
export function orderLabelRowsBestFirst({
  rows,
  direction,
  referenceScores,
}: {
  rows: ReadonlyArray<DistributionChartRow>;
  direction: string | null | undefined;
  /** The evaluator's configured label scores; see getRankedLabelShades. */
  referenceScores?: ReadonlyArray<number | null | undefined>;
}): {
  rows: DistributionChartRow[];
  shades: ReadonlyArray<number | null> | null;
} {
  const shades = getRankedLabelShades({
    direction,
    scores: rows.map((row) => (row.isOther ? null : row.score)),
    referenceScores,
  });
  if (shades == null) {
    return { rows: [...rows], shades: null };
  }
  const ranked = rows.map((row, index) => ({
    row,
    shade: shades[index] ?? null,
  }));
  // Stable, so ties and unscored rows keep their original order.
  ranked.sort((left, right) => (right.shade ?? -1) - (left.shade ?? -1));
  return {
    rows: ranked.map(({ row }) => row),
    shades: ranked.map(({ shade }) => shade),
  };
}

/**
 * Shades score rows from worst (0) to best (1) along the evaluator's
 * optimization direction: exact values by score, histogram bins by midpoint.
 * Rows keep their numeric order; only their shading follows. Null without a
 * direction or fewer than two distinct scores.
 */
export function getRankedScoreRowShades({
  rows,
  direction,
  referenceScores,
}: {
  rows: ReadonlyArray<DistributionChartRow>;
  direction: string | null | undefined;
  /** The evaluator's configured score scale; see getRankedLabelShades. */
  referenceScores?: ReadonlyArray<number | null | undefined>;
}): ReadonlyArray<number | null> | null {
  return getRankedLabelShades({
    direction,
    referenceScores,
    scores: rows.map((row) =>
      row.lowerBound != null && row.upperBound != null
        ? (row.lowerBound + row.upperBound) / 2
        : row.score
    ),
  });
}
