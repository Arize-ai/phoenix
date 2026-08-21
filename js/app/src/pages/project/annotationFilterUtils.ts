import { getDslStringLiteral } from "@phoenix/utils/filterConditionUtils";

export type AnnotationFilterInput = {
  name: string;
  label?: string | null;
  score?: number | null;
};

export type AnnotationFilterDefinition = {
  filterName: string;
  filterCondition: string;
};

type AnnotationAccessor =
  | "annotations"
  | "trace_annotations"
  | "session_annotations";

function getAnnotationAccessorTooltipFilters({
  annotation,
  annotationAccessor,
}: {
  annotation: AnnotationFilterInput;
  annotationAccessor: AnnotationAccessor;
}): AnnotationFilterDefinition[] {
  const { name, label, score } = annotation;
  const nameLiteral = getDslStringLiteral({ value: name, quote: "'" });
  const annotationLabel = `${annotationAccessor}[${nameLiteral}].label`;
  const annotationScore = `${annotationAccessor}[${nameLiteral}].score`;

  const filters: AnnotationFilterDefinition[] = [];
  if (typeof score === "number") {
    filters.push({
      filterName: "greater than",
      filterCondition: `${annotationScore} > ${score}`,
    });
    filters.push({
      filterName: "less than",
      filterCondition: `${annotationScore} < ${score}`,
    });
    filters.push({
      filterName: "equals",
      filterCondition: `${annotationScore} == ${score}`,
    });
  } else if (label != null) {
    const labelLiteral = getDslStringLiteral({ value: label, quote: '"' });
    filters.push({
      filterName: "match",
      filterCondition: `${annotationLabel} == ${labelLiteral}`,
    });
    filters.push({
      filterName: "exclude",
      filterCondition: `(${annotationLabel} != ${labelLiteral} or ${annotationLabel} is None)`,
    });
  }
  return filters;
}

export function getAnnotationTooltipFilters(
  annotation: AnnotationFilterInput
): AnnotationFilterDefinition[] {
  return getAnnotationAccessorTooltipFilters({
    annotation,
    annotationAccessor: "annotations",
  });
}

export function getTraceAnnotationTooltipFilters(
  annotation: AnnotationFilterInput
): AnnotationFilterDefinition[] {
  return getAnnotationAccessorTooltipFilters({
    annotation,
    annotationAccessor: "trace_annotations",
  });
}

export function getSessionAnnotationTooltipFilters(
  annotation: AnnotationFilterInput
): AnnotationFilterDefinition[] {
  return getAnnotationAccessorTooltipFilters({
    annotation,
    annotationAccessor: "session_annotations",
  });
}

function getTraceSpanAnnotationCondition({
  nameLiteral,
  valueCondition,
}: {
  nameLiteral: string;
  valueCondition: string;
}): string {
  return `any(any(annotation.name == ${nameLiteral} and ${valueCondition} for annotation in span.annotations) for span in spans)`;
}

export function getTraceSpanAnnotationTooltipFilters(
  annotation: AnnotationFilterInput
): AnnotationFilterDefinition[] {
  const { name, label, score } = annotation;
  const nameLiteral = getDslStringLiteral({ value: name, quote: "'" });

  if (typeof score === "number") {
    return [
      ["greater than", `annotation.score > ${score}`],
      ["less than", `annotation.score < ${score}`],
      ["equals", `annotation.score == ${score}`],
    ].map(([filterName, valueCondition]) => ({
      filterName,
      filterCondition: getTraceSpanAnnotationCondition({
        nameLiteral,
        valueCondition,
      }),
    }));
  }
  if (label != null) {
    const labelLiteral = getDslStringLiteral({ value: label, quote: '"' });
    const matchingCondition = getTraceSpanAnnotationCondition({
      nameLiteral,
      valueCondition: `annotation.label == ${labelLiteral}`,
    });
    return [
      { filterName: "match", filterCondition: matchingCondition },
      { filterName: "exclude", filterCondition: `not ${matchingCondition}` },
    ];
  }
  return [];
}
