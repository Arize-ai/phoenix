import { css } from "@emotion/react";

import { Token } from "@phoenix/components";

import { getAnnotationTooltipFilters } from "./annotationFilterUtils";
import { useSpanFilters } from "./SpanFiltersContext";

type AnnotationTooltipFilterActionsProps = {
  className?: string;
  annotation: {
    name: string;
    label?: string | null;
    score?: number | null;
  };
  onAppendFilterCondition: (condition: string) => void;
};

export function AnnotationTooltipFilterActions(
  props: AnnotationTooltipFilterActionsProps
) {
  const { annotation, className, onAppendFilterCondition } = props;
  const filters = getAnnotationTooltipFilters(annotation);

  if (filters.length === 0) {
    return null;
  }

  return (
    <ul
      className={className}
      css={css`
        display: flex;
        height: 100%;
        flex-direction: row;
        gap: var(--global-dimension-size-100);

        flex-wrap: wrap;
      `}
    >
      {filters.map((filter) => (
        <li key={filter.filterName}>
          <Token
            onPress={() => {
              onAppendFilterCondition(filter.filterCondition);
            }}
          >
            {filter.filterName}
          </Token>
        </li>
      ))}
    </ul>
  );
}

export function SpanAnnotationTooltipFilterActions(
  props: Omit<AnnotationTooltipFilterActionsProps, "onAppendFilterCondition">
) {
  const { appendFilterCondition } = useSpanFilters();
  return (
    <AnnotationTooltipFilterActions
      {...props}
      onAppendFilterCondition={appendFilterCondition}
    />
  );
}
