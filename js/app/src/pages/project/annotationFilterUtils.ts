import type { AnnotationTargetType } from "@phoenix/components/annotation/types";
import { getDslStringLiteral } from "@phoenix/utils/filterConditionUtils";

/** The subset of an annotation a tooltip filter can be built from. */
export type AnnotationFilterInput = {
  name: string;
  label?: string | null;
  score?: number | null;
};

/**
 * A one-click filter offered in an annotation tooltip/popover: a short action
 * name shown on the token (e.g. "greater than") and the filter DSL condition
 * appended to the page's filter bar when it is pressed.
 */
export type AnnotationFilterDefinition = {
  filterName: string;
  filterCondition: string;
};

/**
 * The filter DSL field that indexes annotations of a given target type, as in
 * `annotations['correctness'].score > 0.5`.
 */
const ANNOTATIONS_DSL_FIELD_BY_TARGET_TYPE: Record<
  AnnotationTargetType,
  string
> = {
  span: "annotations",
  trace: "trace_annotations",
  session: "session_annotations",
};

function getAnnotationTargetTooltipFilters({
  annotation,
  annotationTargetType,
}: {
  /** The annotation value the filters are anchored on. */
  annotation: AnnotationFilterInput;
  /** What the annotation annotates, which picks the filter DSL field. */
  annotationTargetType: AnnotationTargetType;
}): AnnotationFilterDefinition[] {
  const { name, label, score } = annotation;
  const dslField = ANNOTATIONS_DSL_FIELD_BY_TARGET_TYPE[annotationTargetType];
  const nameLiteral = getDslStringLiteral({ value: name, quote: "'" });
  const annotationLabel = `${dslField}[${nameLiteral}].label`;
  const annotationScore = `${dslField}[${nameLiteral}].score`;

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

/** Tooltip filters for span annotations, filtering a table of spans. */
export function getAnnotationTooltipFilters(
  annotation: AnnotationFilterInput
): AnnotationFilterDefinition[] {
  return getAnnotationTargetTooltipFilters({
    annotation,
    annotationTargetType: "span",
  });
}

/** Tooltip filters for trace annotations, filtering a table of traces. */
export function getTraceAnnotationTooltipFilters(
  annotation: AnnotationFilterInput
): AnnotationFilterDefinition[] {
  return getAnnotationTargetTooltipFilters({
    annotation,
    annotationTargetType: "trace",
  });
}

/** Tooltip filters for session annotations, filtering a table of sessions. */
export function getSessionAnnotationTooltipFilters(
  annotation: AnnotationFilterInput
): AnnotationFilterDefinition[] {
  return getAnnotationTargetTooltipFilters({
    annotation,
    annotationTargetType: "session",
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

/**
 * Tooltip filters for span annotations when the table being filtered holds
 * traces: the plain `annotations[...]` field only reads the root span, so
 * these conditions instead match a trace when any of its spans carries the
 * annotation value.
 */
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
