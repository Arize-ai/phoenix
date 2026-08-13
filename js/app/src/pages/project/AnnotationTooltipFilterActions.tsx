import { css } from "@emotion/react";
import type { Ref } from "react";

import {
  Button,
  Flex,
  Icon,
  Icons,
  Menu,
  MenuContainer,
  MenuHeader,
  MenuHeaderTitle,
  MenuItem,
  MenuTrigger,
  Text,
  Truncate,
  View,
} from "@phoenix/components";
import { AnnotationScoreText } from "@phoenix/components/annotation/AnnotationScoreText";
import { assertUnreachable } from "@phoenix/typeUtils";
import { floatFormatter } from "@phoenix/utils/numberFormatUtils";

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
  onOpenChange?: (isOpen: boolean) => void;
  popoverRef?: Ref<HTMLDivElement>;
  positiveOptimization?: boolean | null;
  targetKind?: "session" | "span" | "trace";
};

const filterActionsCSS = css`
  position: relative;
  display: inline-flex;
  justify-content: flex-end;
  flex: none;
  width: var(--global-button-height-s);
  height: var(--global-button-height-s);

  .annotation-filter-actions__trigger {
    position: absolute;
    top: 0;
    right: 0;
    width: var(--global-button-height-s);
    white-space: nowrap;
  }

  .annotation-filter-actions__trigger-label {
    display: none;
  }

  &:has(.annotation-filter-actions__trigger[data-hovered]),
  &:has(.annotation-filter-actions__trigger[data-focus-visible]),
  &:has(.annotation-filter-actions__trigger[aria-expanded="true"]) {
    .annotation-filter-actions__trigger {
      width: auto;
      background-color: var(--global-input-field-background-color);
      border-color: var(--global-input-field-border-color);
    }

    .annotation-filter-actions__trigger-label {
      display: inline;
    }
  }
`;

const annotationFilterMenuCSS = css`
  --menu-min-width: var(--global-dimension-size-2500);
`;

function getFilterPresentation(filter: AnnotationFilterDefinition) {
  switch (filter.filterName) {
    case "greater than":
      return { label: "Higher than", operator: ">" };
    case "less than":
      return { label: "Lower than", operator: "<" };
    case "equals":
    case "match":
      return { label: "Exactly", operator: "=" };
  }
  return assertUnreachable(filter.filterName);
}

export function AnnotationTooltipFilterActions(
  props: AnnotationTooltipFilterActionsProps
) {
  const {
    annotation,
    className,
    onAppendFilterCondition,
    getFilters = getAnnotationTooltipFilters,
    positiveOptimization,
    targetKind,
  } = props;
  const filters = getFilters(annotation);

  if (filters.length === 0) {
    return null;
  }

  const targetLabel = targetKind ? `${targetKind}s` : "annotations";
  const annotationValue =
    typeof annotation.score === "number"
      ? floatFormatter(annotation.score)
      : annotation.label;

  return (
    <div className={className} css={filterActionsCSS}>
      <MenuTrigger onOpenChange={props.onOpenChange}>
        <Button
          className="annotation-filter-actions__trigger"
          size="S"
          variant="quiet"
          aria-label={`Filter ${targetLabel} by annotation value`}
          leadingVisual={<Icon svg={<Icons.ListFilter />} />}
        >
          <span className="annotation-filter-actions__trigger-label">
            Filter
          </span>
        </Button>
        <MenuContainer
          placement="right top"
          shouldFlip
          isNonModal
          ref={props.popoverRef}
          minHeight={0}
          aria-label={`Filter ${targetLabel}`}
        >
          <MenuHeader>
            <MenuHeaderTitle>{`Filter ${targetLabel}`}</MenuHeaderTitle>
          </MenuHeader>
          <Menu
            aria-label={`Filter ${targetLabel} by annotation value`}
            css={annotationFilterMenuCSS}
            onAction={(action) => onAppendFilterCondition(String(action))}
          >
            {filters.map((filter) => {
              const presentation = getFilterPresentation(filter);
              return (
                <MenuItem
                  key={filter.filterName}
                  id={filter.filterCondition}
                  textValue={`${presentation.label} ${annotationValue ?? ""}`.trim()}
                  leadingContent={
                    <Text fontFamily="mono" size="M">
                      {presentation.operator}
                    </Text>
                  }
                >
                  <Flex
                    alignItems="center"
                    gap="size-100"
                    minWidth={0}
                    flex={1}
                  >
                    <Text>{presentation.label}</Text>
                    {typeof annotation.score === "number" ? (
                      <AnnotationScoreText
                        elementType="span"
                        fontFamily="mono"
                        positiveOptimization={positiveOptimization}
                      >
                        {annotationValue}
                      </AnnotationScoreText>
                    ) : annotation.label != null ? (
                      <View minWidth={0} flex={1}>
                        <Truncate maxWidth="100%" title={annotation.label}>
                          <Text>{annotation.label}</Text>
                        </Truncate>
                      </View>
                    ) : null}
                  </Flex>
                </MenuItem>
              );
            })}
          </Menu>
        </MenuContainer>
      </MenuTrigger>
    </div>
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
