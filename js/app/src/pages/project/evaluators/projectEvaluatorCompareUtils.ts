import type { ConfusionMatrixDatum } from "@phoenix/components/chart";
import {
  formatEvaluationTargetPlural,
  type ProjectEvaluatorTarget,
} from "@phoenix/pages/project/evaluators/projectEvaluatorTypes";
import { formatInt } from "@phoenix/utils/numberFormatUtils";

export const FLAGGED_LABEL = "flagged";
export const NOT_FLAGGED_LABEL = "not flagged";
export const OTHER_LABEL = "other";

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

const isBinaryFlagPair = (labels: readonly string[]) =>
  labels.length === 2 &&
  labels.includes(FLAGGED_LABEL) &&
  labels.includes(NOT_FLAGGED_LABEL);

export function getPositiveLabel(
  labelsA: readonly string[],
  labelsB: readonly string[]
): string | undefined {
  return isBinaryFlagPair(labelsA) && isBinaryFlagPair(labelsB)
    ? FLAGGED_LABEL
    : undefined;
}

const formatThreshold = (threshold: number) => `${threshold}`;

export function formatMatrixSubtitle({
  target,
  evaluatedByBoth,
  thresholdA,
  thresholdB,
}: {
  target: ProjectEvaluatorTarget;
  evaluatedByBoth: number;
  thresholdA: number | null;
  thresholdB: number | null;
}): string {
  const scope = `${formatInt(evaluatedByBoth)} ${formatEvaluationTargetPlural(
    target
  )} evaluated by both`;
  if (thresholdA == null && thresholdB == null) {
    return scope;
  }
  if (thresholdA != null && thresholdA === thresholdB) {
    return `${scope} · flagged at score ≥ ${formatThreshold(thresholdA)}`;
  }
  const thresholds = [
    thresholdA == null
      ? null
      : `A flagged at score ≥ ${formatThreshold(thresholdA)}`,
    thresholdB == null
      ? null
      : `B flagged at score ≥ ${formatThreshold(thresholdB)}`,
  ].filter((value): value is string => value != null);
  return `${scope} · ${thresholds.join(" · ")}`;
}
