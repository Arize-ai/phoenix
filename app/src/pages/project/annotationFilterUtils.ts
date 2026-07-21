import { getDslStringLiteral } from "@phoenix/components/filter/filterUtils";

export type AnnotationFilterInput = {
  name: string;
  label?: string | null;
  score?: number | null;
};

export type AnnotationFilterDefinition = {
  filterName: string;
  filterCondition: string;
};

export function getAnnotationTooltipFilters(
  annotation: AnnotationFilterInput
): AnnotationFilterDefinition[] {
  const { name, label, score } = annotation;
  const nameLiteral = getDslStringLiteral({ value: name, quote: "'" });
  const annotationLabel = `annotations[${nameLiteral}].label`;
  const annotationScore = `annotations[${nameLiteral}].score`;

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
