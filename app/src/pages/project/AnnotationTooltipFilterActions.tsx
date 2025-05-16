import { useMemo } from "react";
import { css } from "@emotion/react";

import { Token } from "@phoenix/components";

import { useSpanFilterCondition } from "./SpanFilterConditionContext";

type AnnotationTooltipFilterActionsProps = {
  className?: string;
  annotation: {
    name: string;
    label?: string | null;
    score?: number | null;
  };
};

type FilterDefinition = {
  /**
   * The human-readable name of the filter.
   */
  filterName: string;
  /**
   * The condition that the filter represents using DSL
   */
  filterCondition: string;
};

export function AnnotationTooltipFilterActions(
  props: AnnotationTooltipFilterActionsProps
) {
  const { appendFilterCondition } = useSpanFilterCondition();
  const { annotation, className } = props;
  const { name, label, score } = annotation;

  const filters = useMemo(() => {
    const filters: FilterDefinition[] = [];
    if (typeof score === "number") {
      filters.push({
        filterName: "greater than",
        filterCondition: `annotations['${name}'].score > ${score}`,
      });
      filters.push({
        filterName: "less than",
        filterCondition: `annotations['${name}'].score < ${score}`,
      });
      filters.push({
        filterName: "equals",
        filterCondition: `annotations['${name}'].score == ${score}`,
      });
    } else if (label != null) {
      filters.push({
        filterName: "match",
        filterCondition: `annotations['${name}'].label == "${label}"`,
      });
      filters.push({
        filterName: "exclude",
        filterCondition: `annotations['${name}'].label != "${label}"`,
      });
    }
    return filters;
  }, [name, label, score]);

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
        gap: var(--ac-global-dimension-size-100);

        flex-wrap: wrap;
      `}
    >
      {filters.map((filter) => (
        <li key={filter.filterName}>
          <Token
            onPress={() => {
              appendFilterCondition(filter.filterCondition);
            }}
          >
            {filter.filterName}
          </Token>
        </li>
      ))}
    </ul>
  );
}
