import { ANNOTATIONS_DSL_FIELD_BY_TARGET_TYPE } from "@phoenix/pages/project/annotationFilterUtils";
import type { EvaluatorOptimizationDirection } from "@phoenix/types/evaluators";
import {
  getDslStringLiteral,
  joinFilterConditions,
} from "@phoenix/utils/filterConditionUtils";

import type { CompareSelection } from "./projectEvaluatorCompareSelection";
import { getFlagThresholdOperators } from "./projectEvaluatorCompareUtils";

export type CompareTarget = "SPAN" | "TRACE" | "SESSION";
export type CompareFilterSide = {
  annotationName: string;
  labels: readonly string[];
  threshold: number | null;
  optimizationDirection: EvaluatorOptimizationDirection | null;
};

const TARGET_TYPES = {
  SPAN: "span",
  TRACE: "trace",
  SESSION: "session",
} as const;

function getAnnotationField({
  target,
  side,
}: {
  target: CompareTarget;
  side: CompareFilterSide;
}) {
  return `${ANNOTATIONS_DSL_FIELD_BY_TARGET_TYPE[TARGET_TYPES[target]]}[${getDslStringLiteral({ value: side.annotationName, quote: "'" })}]`;
}

function buildBinCondition({
  field,
  side,
  label,
}: {
  field: string;
  side: CompareFilterSide;
  label: string;
}): string {
  if (side.threshold != null) {
    const operators = getFlagThresholdOperators(side.optimizationDirection);
    const operator =
      label === "flagged" ? operators.flagged : operators.unflagged;
    return `${field}.score ${operator} ${side.threshold}`;
  }
  if (label === "other") {
    return [
      `${field}.label is not None`,
      ...side.labels
        .filter((value) => value !== "other")
        .map(
          (value) =>
            `${field}.label != ${getDslStringLiteral({ value, quote: '"' })}`
        ),
    ].join(" and ");
  }
  return `${field}.label == ${getDslStringLiteral({ value: label, quote: '"' })}`;
}

export function isCompareSelectionValid({
  selection,
  sideA,
  sideB,
}: {
  selection: CompareSelection;
  sideA: CompareFilterSide;
  sideB: CompareFilterSide;
}): boolean {
  return (
    sideA.labels.includes(selection.a) && sideB.labels.includes(selection.b)
  );
}

export function buildCompareFilterCondition({
  target,
  selection,
  sideA,
  sideB,
}: {
  target: CompareTarget;
  selection: CompareSelection | null;
  sideA: CompareFilterSide;
  sideB: CompareFilterSide;
}): string {
  const fieldA = getAnnotationField({ target, side: sideA });
  const fieldB = getAnnotationField({ target, side: sideB });
  if (!selection || !isCompareSelectionValid({ selection, sideA, sideB }))
    // Bare annotation references select targets evaluated by both names.
    return joinFilterConditions({
      existingCondition: fieldA,
      nextCondition: fieldB,
    });
  return joinFilterConditions({
    existingCondition: buildBinCondition({
      field: fieldA,
      side: sideA,
      label: selection.a,
    }),
    nextCondition: buildBinCondition({
      field: fieldB,
      side: sideB,
      label: selection.b,
    }),
  });
}
