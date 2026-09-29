import type { AnnotationOptimizationConfig } from "@phoenix/components/annotation";
import type { ConfusionMatrixDatum } from "@phoenix/components/chart";
import {
  formatEvaluationTargetPlural,
  type ProjectEvaluatorTarget,
} from "@phoenix/pages/project/evaluators/projectEvaluatorTypes";
import type { EvaluatorOptimizationDirection } from "@phoenix/types/evaluators";
import { formatInt } from "@phoenix/utils/numberFormatUtils";

/**
 * The palette hue each side draws in (a hue with 100–1400 steps in the global
 * color tokens): step 700 is the evaluator's color, and its labels shade
 * across the steps.
 */
export const EVALUATOR_COMPARE_HUES = {
  a: "blue",
  b: "orange",
} as const;

export type EvaluatorCompareHue =
  (typeof EVALUATOR_COMPARE_HUES)[keyof typeof EVALUATOR_COMPARE_HUES];

export const EVALUATOR_COMPARE_COLORS = {
  a: `var(--global-color-${EVALUATOR_COMPARE_HUES.a}-700)`,
  b: `var(--global-color-${EVALUATOR_COMPARE_HUES.b}-700)`,
} as const;

/**
 * The scores an evaluator's output config pins down: its label scores, or its
 * score bounds. Lets shading rank a result on the evaluator's whole scale
 * even when only one value appears in range.
 */
export function getConfiguredScores(
  config: AnnotationOptimizationConfig | undefined
): ReadonlyArray<number | null | undefined> {
  if (config == null) return [];
  if (config.values) return config.values.map(({ score }) => score);
  return [config.lowerBound, config.upperBound];
}

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
/**
 * The palette steps label shades span: the most optimal label takes the step
 * furthest from the background, the least optimal the nearest. Low steps sit
 * near the background in both themes, so the ramp holds in light and dark.
 */
const MOST_OPTIMAL_STEP = 900;
const LEAST_OPTIMAL_STEP = 400;
const PALETTE_STEP = 100;

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
 * Stand-in optimalities for labels without an optimization direction: the
 * same shades, stepped through in display order, so an evaluator's labels
 * look the same whether or not they rank. The first label takes the strongest
 * shade; here the shades carry no ranking.
 */
export function getPositionalOptimalities(count: number): number[] {
  return Array.from({ length: count }, (_, index) =>
    count <= 1 ? 1 : 1 - index / (count - 1)
  );
}

/**
 * Shades a label within its evaluator's hue by optimality: the best label
 * takes the strongest step and worse ones step toward the background, spread
 * evenly and rounded to a palette step. Null optimality (a label without a
 * score) is neutral gray.
 */
export function getLabelOptimalityColor({
  hue,
  optimality,
}: {
  hue: EvaluatorCompareHue;
  optimality: number | null;
}): string {
  if (optimality == null) return NEUTRAL_LABEL_COLOR;
  const steps = (MOST_OPTIMAL_STEP - LEAST_OPTIMAL_STEP) / PALETTE_STEP;
  const step =
    LEAST_OPTIMAL_STEP + Math.round(optimality * steps) * PALETTE_STEP;
  return `var(--global-color-${hue}-${step})`;
}
