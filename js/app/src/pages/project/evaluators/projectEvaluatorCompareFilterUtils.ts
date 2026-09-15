import { ANNOTATIONS_DSL_FIELD_BY_TARGET_TYPE } from "@phoenix/pages/project/annotationFilterUtils";
import type { EvaluatorOptimizationDirection } from "@phoenix/types/evaluators";
import {
  getDslStringLiteral,
  joinFilterConditions,
} from "@phoenix/utils/filterConditionUtils";

import type { CompareSelection } from "./projectEvaluatorCompareSelection";
import {
  getDistributionRows,
  type DistributionSide,
} from "./projectEvaluatorDistributionUtils";

export type CompareTarget = "SPAN" | "TRACE" | "SESSION";
export type CompareFilterSide = {
  annotationName: string;
  labels: readonly string[];
  threshold: number | null;
  optimizationDirection: EvaluatorOptimizationDirection | null;
  flaggedLabels?: readonly string[] | null;
  distribution?: DistributionSide;
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
    const isFlagged = label === "flagged";
    const isMaximize = side.optimizationDirection === "MAXIMIZE";
    const operator = isFlagged
      ? isMaximize
        ? "<="
        : ">="
      : isMaximize
        ? ">"
        : "<";
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
  if (selection.kind === "matrix")
    return (
      sideA.labels.includes(selection.a) && sideB.labels.includes(selection.b)
    );
  const side = selection.side === "a" ? sideA : sideB;
  if (selection.kind === "flag")
    return side.threshold != null || side.flaggedLabels != null;
  if (!side.distribution) return false;
  return getDistributionRows({
    side: side.distribution,
    view: selection.view,
  }).some(
    (row) =>
      row.label === selection.label &&
      (selection.view === "labels" ||
        (selection.score != null
          ? row.score === selection.score
          : row.lowerBound === selection.lowerBound &&
            row.upperBound === selection.upperBound))
  );
}

/** Build the table population without deriving a row count from the matrix. */
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
  const evaluated = (field: string) =>
    `${field}.score is not None or ${field}.label is not None`;
  if (!selection || !isCompareSelectionValid({ selection, sideA, sideB }))
    return joinFilterConditions({
      existingCondition: evaluated(fieldA),
      nextCondition: evaluated(fieldB),
    });
  if (selection.kind === "matrix")
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
  const side = selection.side === "a" ? sideA : sideB;
  const field = selection.side === "a" ? fieldA : fieldB;
  if (selection.kind === "flag") {
    const labels = side.labels.filter(
      (label) =>
        (side.flaggedLabels?.includes(label) ?? label === "flagged") ===
        selection.flagged
    );
    const condition =
      labels
        .map((label) => `(${buildBinCondition({ field, side, label })})`)
        .join(" or ") || "False";
    return joinFilterConditions({
      existingCondition: condition,
      nextCondition: evaluated(selection.side === "a" ? fieldB : fieldA),
    });
  }
  return buildDistributionCondition({ field, side, selection });
}

function buildDistributionCondition({
  field,
  side,
  selection,
}: {
  field: string;
  side: CompareFilterSide;
  selection: Extract<CompareSelection, { kind: "distribution" }>;
}): string {
  if (selection.view === "labels") {
    const distribution = side.distribution;
    const rows = distribution
      ? getDistributionRows({ side: distribution, view: "labels" })
      : [];
    const index = rows.findIndex((row) => row.label === selection.label);
    const point = distribution?.labelCounts?.[index];
    if (point?.isOther) {
      return [
        `${field}.label is not None`,
        ...(distribution?.labelCounts ?? [])
          .filter((label) => !label.isOther)
          .map(
            (label) =>
              `${field}.label != ${getDslStringLiteral({ value: label.label, quote: '"' })}`
          ),
      ].join(" and ");
    }
    return `${field}.label == ${getDslStringLiteral({ value: point?.label ?? selection.label, quote: '"' })}`;
  }
  if (selection.score != null) return `${field}.score == ${selection.score}`;
  const edges = side.distribution?.scoreBinEdges;
  const isLastBin =
    edges != null && selection.upperBound === edges[edges.length - 1];
  return `${field}.score >= ${selection.lowerBound} and ${field}.score ${isLastBin ? "<=" : "<"} ${selection.upperBound}`;
}
