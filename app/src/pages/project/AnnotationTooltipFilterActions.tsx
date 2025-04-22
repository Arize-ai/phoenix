import React, { PropsWithChildren, useMemo } from "react";
import { css } from "@emotion/react";

import { Flex, Text, View } from "@phoenix/components";

import { useSpanFilterCondition } from "./SpanFilterConditionContext";

type AnnotationTooltipFilterActionsProps = {
  annotation: {
    name: string;
    label: string | null;
    score: number | null;
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
  const { annotation } = props;
  const { name, label, score } = annotation;

  const filters = useMemo(() => {
    const filters: FilterDefinition[] = [];
    if (label != null) {
      filters.push({
        filterName: "Match label",
        filterCondition: `annotations['${name}'].label == "${label}"`,
      });
      filters.push({
        filterName: "Exclude label",
        filterCondition: `annotations['${name}'].label != "${label}"`,
      });
    }
    if (typeof score === "number") {
      filters.push({
        filterName: "Greater than score",
        filterCondition: `annotations['${name}'].score > ${score}`,
      });
      filters.push({
        filterName: "Less than score",
        filterCondition: `annotations['${name}'].score < ${score}`,
      });
      filters.push({
        filterName: "Equals score",
        filterCondition: `annotations['${name}'].score == ${score}`,
      });
    }
    return filters;
  }, [name, label, score]);

  if (filters.length === 0) {
    return null;
  }

  return (
    <View
      borderStartWidth="thin"
      borderColor="dark"
      paddingStart="size-200"
      paddingEnd="size-100"
      marginStart="size-200"
      width={300}
      minHeight={160}
    >
      <Flex direction="column" gap="size-100" height="100%">
        <Text weight="heavy">Filters</Text>
        <ul
          css={css`
            display: flex;
            height: 100%;
            flex-direction: row;
            gap: var(--ac-global-dimension-size-100);
            color: var(--ac-global-color-primary);
            padding: var(--ac-global-dimension-size-100) 0;
            flex-wrap: wrap;
          `}
        >
          {filters.map((filter) => (
            <li key={filter.filterName}>
              <FilterItem
                onClick={() => {
                  appendFilterCondition(filter.filterCondition);
                }}
              >
                {filter.filterName}
              </FilterItem>
            </li>
          ))}
        </ul>
      </Flex>
    </View>
  );
}

function FilterItem({
  onClick,
  children,
}: PropsWithChildren<{ onClick: () => void }>) {
  return (
    <button
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick();
      }}
      className="button--reset"
      css={css`
        color: var(--ac-global-text-color-900);
        border: 1px solid var(--ac-global-color-grey-300);
        border-radius: 4px;
        padding: var(--ac-global-dimension-size-50)
          var(--ac-global-dimension-size-100);
        cursor: pointer;
        transition: background-color 0.2s;
        &:hover {
          background-color: var(--ac-global-color-gray-300);
        }
      `}
    >
      {children}
    </button>
  );
}
