import { css } from "@emotion/react";

import { Flex, Icon, Icons, Token } from "@phoenix/components";

import {
  type AnnotationFilterDefinition,
  getAnnotationTooltipFilters,
  getTraceSpanAnnotationTooltipFilters,
} from "./annotationFilterUtils";
import { useSpanFilterActions } from "./SpanFiltersContext";
import { useTraceFilters } from "./TraceFiltersContext";

type AnnotationTooltipFilterActionsProps = {
  className?: string;
  annotation: {
    name: string;
    label?: string | null;
    score?: number | null;
  };
  onAppendFilterCondition: (condition: string) => void;
  getFilters?: (annotation: {
    name: string;
    label?: string | null;
    score?: number | null;
  }) => AnnotationFilterDefinition[];
};

export function AnnotationTooltipFilterActions(
  props: AnnotationTooltipFilterActionsProps
) {
  const {
    annotation,
    className,
    onAppendFilterCondition,
    getFilters = getAnnotationTooltipFilters,
  } = props;
  const filters = getFilters(annotation);

  if (filters.length === 0) {
    return null;
  }

  return (
    <Flex
      className={className}
      direction="row"
      alignItems="center"
      gap="size-100"
    >
      <Icon aria-hidden svg={<Icons.ListFilter />} />
      <ul
        aria-label="Annotation filters"
        css={css`
          display: flex;
          min-width: 0;
          flex-direction: row;
          flex-wrap: wrap;
          gap: var(--global-dimension-size-100);
          list-style: none;
          margin: 0;
          padding: 0;
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
    </Flex>
  );
}

export function SpanAnnotationTooltipFilterActions(
  props: Omit<AnnotationTooltipFilterActionsProps, "onAppendFilterCondition">
) {
  const { appendFilterCondition } = useSpanFilterActions();
  return (
    <AnnotationTooltipFilterActions
      {...props}
      onAppendFilterCondition={appendFilterCondition}
    />
  );
}

export function TraceSpanAnnotationTooltipFilterActions(
  props: Omit<
    AnnotationTooltipFilterActionsProps,
    "getFilters" | "onAppendFilterCondition"
  >
) {
  const { appendFilterCondition } = useTraceFilters();
  return (
    <AnnotationTooltipFilterActions
      {...props}
      getFilters={getTraceSpanAnnotationTooltipFilters}
      onAppendFilterCondition={appendFilterCondition}
    />
  );
}
