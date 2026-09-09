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

const formatThreshold = (threshold: number) => `${threshold}`;

const getFlaggedThresholdOperator = (
  optimizationDirection: EvaluatorOptimizationDirection | null
) => (optimizationDirection === "MAXIMIZE" ? "≤" : "≥");

export function formatMatrixSubtitle({
  target,
  evaluatedByBoth,
  thresholdA,
  thresholdB,
  optimizationDirectionA,
  optimizationDirectionB,
}: {
  target: ProjectEvaluatorTarget;
  evaluatedByBoth: number;
  thresholdA: number | null;
  thresholdB: number | null;
  optimizationDirectionA: EvaluatorOptimizationDirection | null;
  optimizationDirectionB: EvaluatorOptimizationDirection | null;
}): string {
  const scope = `${formatInt(evaluatedByBoth)} ${formatEvaluationTargetPlural(
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
