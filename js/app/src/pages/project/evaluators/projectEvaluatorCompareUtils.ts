import type { ConfusionMatrixDatum } from "@phoenix/components/chart";
import {
  formatEvaluationTargetPlural,
  type ProjectEvaluatorTarget,
} from "@phoenix/pages/project/evaluators/projectEvaluatorTypes";
import type { EvaluatorOptimizationDirection } from "@phoenix/types/evaluators";
import { formatInt } from "@phoenix/utils/numberFormatUtils";

export const EVALUATOR_COMPARE_COLORS = {
  a: "var(--global-color-blue-700)",
  b: "var(--global-color-orange-600)",
} as const;

export function toConfusionMatrixData({
  matrix,
  rowLabels,
  columnLabels,
}: {
  matrix: ReadonlyArray<ReadonlyArray<number>>;
  rowLabels: readonly string[];
  columnLabels: readonly string[];
}): ConfusionMatrixDatum[] {
  const data: ConfusionMatrixDatum[] = [];
  rowLabels.forEach((actual, rowIndex) => {
    columnLabels.forEach((predicted, columnIndex) => {
      const count = matrix[rowIndex]?.[columnIndex] ?? 0;
      if (count > 0) {
        data.push({ actual, predicted, count });
      }
    });
  });
  return data;
}

export function getKappaGloss(kappa: number | null): string | null {
  if (kappa == null) return null;
  if (kappa < 0) return "poor";
  if (kappa <= 0.2) return "slight";
  if (kappa <= 0.4) return "fair";
  if (kappa <= 0.6) return "moderate";
  if (kappa <= 0.8) return "substantial";
  return "almost perfect";
}

/**
 * Returns the compared output's concise name when an evaluator has multiple
 * outputs. Single-output annotations are stored under the evaluator name and
 * need no extra label.
 */
export function getComparedOutputName({
  evaluatorName,
  annotationName,
}: {
  evaluatorName: string;
  annotationName: string;
}): string | null {
  if (annotationName === evaluatorName) {
    return null;
  }
  const multiOutputPrefix = `${evaluatorName}.`;
  return annotationName.startsWith(multiOutputPrefix)
    ? annotationName.slice(multiOutputPrefix.length)
    : annotationName;
}

const formatThreshold = (threshold: number) => `${threshold}`;

/** Returns filter operators that match the server's flag-threshold split. */
export function getFlagThresholdOperators(
  optimizationDirection: EvaluatorOptimizationDirection | null
): { flagged: "<=" | ">="; unflagged: ">" | "<" } {
  return optimizationDirection === "MAXIMIZE"
    ? { flagged: "<=", unflagged: ">" }
    : { flagged: ">=", unflagged: "<" };
}

const THRESHOLD_OPERATOR_SYMBOLS = { "<=": "≤", ">=": "≥" } as const;

const getFlaggedThresholdOperator = (
  optimizationDirection: EvaluatorOptimizationDirection | null
) =>
  THRESHOLD_OPERATOR_SYMBOLS[
    getFlagThresholdOperators(optimizationDirection).flagged
  ];

export function formatMatrixSubtitle({
  target,
  populationSize,
  thresholdA,
  thresholdB,
  optimizationDirectionA,
  optimizationDirectionB,
}: {
  target: ProjectEvaluatorTarget;
  populationSize: number;
  thresholdA: number | null;
  thresholdB: number | null;
  optimizationDirectionA: EvaluatorOptimizationDirection | null;
  optimizationDirectionB: EvaluatorOptimizationDirection | null;
}): string {
  const scope = `${formatInt(populationSize)} ${formatEvaluationTargetPlural(
    target
  )} evaluated by both`;
  if (thresholdA == null && thresholdB == null) {
    return scope;
  }
  const operatorA = getFlaggedThresholdOperator(optimizationDirectionA);
  const operatorB = getFlaggedThresholdOperator(optimizationDirectionB);
  if (
    thresholdA != null &&
    thresholdA === thresholdB &&
    operatorA === operatorB
  ) {
    return `${scope} · flagged at score ${operatorA} ${formatThreshold(thresholdA)}`;
  }
  const thresholds = [
    thresholdA == null
      ? null
      : `A flagged at score ${operatorA} ${formatThreshold(thresholdA)}`,
    thresholdB == null
      ? null
      : `B flagged at score ${operatorB} ${formatThreshold(thresholdB)}`,
  ].filter((value): value is string => value != null);
  return `${scope} · ${thresholds.join(" · ")}`;
}

/** Neutral fill for labels that carry no optimization meaning. */
export const NEUTRAL_LABEL_COLOR = "var(--global-color-gray-400)";
/** How much of the evaluator color the least optimal label keeps. */
const LEAST_OPTIMAL_COLOR_SHARE = 0.3;

/**
 * Ranks labels from least (0) to most (1) optimal by their mapped scores and
 * the evaluator's optimization direction, spacing distinct scores evenly so
 * every step reads as a visible change. A label without a score gets null.
 *
 * Returns null when the labels carry no such meaning: no MAXIMIZE/MINIMIZE
 * direction, or fewer than two distinct scores to order.
 */
export function getLabelOptimalities({
  direction,
  scores,
  referenceScores = [],
}: {
  direction: string | null | undefined;
  scores: ReadonlyArray<number | null | undefined>;
  /**
   * The evaluator's configured scores (label scores, or score bounds), ranked
   * alongside `scores` so a lone label present in range still gets its place
   * on the evaluator's scale.
   */
  referenceScores?: ReadonlyArray<number | null | undefined>;
}): ReadonlyArray<number | null> | null {
  if (direction !== "MAXIMIZE" && direction !== "MINIMIZE") {
    return null;
  }
  const distinctScores = Array.from(
    new Set(
      [...scores, ...referenceScores].filter(
        (score): score is number => score != null
      )
    )
  ).sort((left, right) => left - right);
  if (distinctScores.length < 2) {
    return null;
  }
  const lastRank = distinctScores.length - 1;
  return scores.map((score) => {
    if (score == null) return null;
    const ascending = distinctScores.indexOf(score) / lastRank;
    return direction === "MAXIMIZE" ? ascending : 1 - ascending;
  });
}

/**
 * Desaturates an evaluator color toward gray as a label gets less optimal, so
 * the best label keeps the full evaluator color. Null optimality (a label
 * without a score) is neutral gray.
 */
export function getLabelOptimalityColor({
  color,
  optimality,
}: {
  color: string;
  optimality: number | null;
}): string {
  if (optimality == null) return NEUTRAL_LABEL_COLOR;
  const share =
    LEAST_OPTIMAL_COLOR_SHARE + (1 - LEAST_OPTIMAL_COLOR_SHARE) * optimality;
  return `color-mix(in oklch, ${color} ${Math.round(share * 100)}%, ${NEUTRAL_LABEL_COLOR})`;
}
