import { css } from "@emotion/react";
import type { CSSProperties, Ref } from "react";
import { useState } from "react";

import {
  Button,
  Flex,
  Group,
  Icon,
  Icons,
  Menu,
  MenuContainer,
  MenuHeader,
  MenuHeaderTitle,
  MenuItem,
  MenuTrigger,
  Text,
} from "@phoenix/components";
import { formatAnnotationScore } from "@phoenix/components/annotation/annotationFormatUtils";
import { AnnotationScoreText } from "@phoenix/components/annotation/AnnotationScoreText";
import { classNames } from "@phoenix/utils/classNames";

import { useSpanFilters } from "./SpanFiltersContext";

type AnnotationTooltipFilterActionsProps = {
  className?: string;
  displayMode?: "collapsible" | "expanded";
  annotation: {
    name: string;
    label?: string | null;
    optimizationValue?: number | null;
    score?: number | null;
  };
  isOpen?: boolean;
  onOpenChange?: (isOpen: boolean) => void;
  targetKind?: "session" | "span" | "trace";
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
  icon: "equal" | "greater-than" | "less-than" | "not-equal";
  menuLabel: string;
};

const compactButtonStyle: CSSProperties = {
  width: "var(--global-dimension-size-300)",
  minWidth: "var(--global-dimension-size-300)",
  height: "var(--global-dimension-size-300)",
  minHeight: "var(--global-dimension-size-300)",
};

const joinedFilterButtonCSS = css`
  position: relative;
  border-radius: 0;

  &:not(:first-of-type) {
    border-left: none;
  }

  &:first-of-type {
    border-radius: var(--global-rounding-small) 0 0 var(--global-rounding-small);
  }

  &:last-of-type {
    border-radius: 0 var(--global-rounding-small) var(--global-rounding-small) 0;
  }

  &:only-of-type {
    border-radius: var(--global-rounding-small);
  }

  &[data-focus-visible] {
    z-index: 1;
  }
`;

const collapsibleFilterActionsCSS = css`
  position: relative;
  display: inline-flex;
  justify-content: flex-end;
  flex: none;
  height: var(--global-button-height-s);
  overflow: visible;

  .annotation-filter-actions__sizer {
    visibility: hidden;
    pointer-events: none;
    display: flex;
    align-items: center;
    gap: var(--global-dimension-size-100);
    box-sizing: border-box;
    height: var(--global-button-height-s);
    padding: var(--global-dimension-size-50) var(--global-dimension-size-100);
    border: 1px solid transparent;
    font-size: var(--global-dimension-font-size-100);
    line-height: 20px;
    white-space: nowrap;
  }

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

  &:has(.annotation-filter-actions__trigger:hover),
  &:focus-within,
  &[data-open="true"] {
    .annotation-filter-actions__trigger {
      width: auto;
    }

    .annotation-filter-actions__trigger-label {
      display: inline;
    }
  }
`;

const truncatedAnnotationValueCSS = css`
  display: inline-block;
  max-width: var(--global-dimension-size-3000);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const annotationFilterMenuCSS = css`
  --menu-min-width: var(--global-dimension-size-2500);
`;

export function getAnnotationFilterDefinitions({
  name,
  label,
  score,
}: AnnotationTooltipFilterActionsProps["annotation"]): FilterDefinition[] {
  if (typeof score === "number") {
    return [
      {
        filterName: "greater than",
        filterCondition: `annotations['${name}'].score > ${score}`,
        icon: "greater-than",
        menuLabel: "Higher than",
      },
      {
        filterName: "less than",
        filterCondition: `annotations['${name}'].score < ${score}`,
        icon: "less-than",
        menuLabel: "Lower than",
      },
      {
        filterName: "equals",
        filterCondition: `annotations['${name}'].score == ${score}`,
        icon: "equal",
        menuLabel: "Exactly",
      },
    ];
  }
  if (label != null) {
    return [
      {
        filterName: "matches",
        filterCondition: `annotations['${name}'].label == "${label}"`,
        icon: "equal",
        menuLabel: "Exactly",
      },
      {
        filterName: "does not match",
        filterCondition: `annotations['${name}'].label != "${label}"`,
        icon: "not-equal",
        menuLabel: "Not",
      },
    ];
  }
  return [];
}

function getAnnotationFilterMenuDefinitions(
  annotation: AnnotationTooltipFilterActionsProps["annotation"]
): FilterDefinition[] {
  const filters = getAnnotationFilterDefinitions(annotation);
  if (typeof annotation.score !== "number") {
    return filters;
  }
  return [
    ...filters,
    {
      filterName: "does not equal",
      filterCondition: `annotations['${annotation.name}'].score != ${annotation.score}`,
      icon: "not-equal",
      menuLabel: "Not",
    },
  ];
}

function AnnotationFilterIcon({ icon }: Pick<FilterDefinition, "icon">) {
  switch (icon) {
    case "equal":
      return <Icon svg={<Icons.Equal />} />;
    case "greater-than":
      return <Icon svg={<Icons.GreaterThan />} />;
    case "less-than":
      return <Icon svg={<Icons.LessThan />} />;
    case "not-equal":
      return <Icon svg={<Icons.NotEqual />} />;
  }
  return null;
}

function AnnotationFilterButtons({
  filters,
  firstButtonRef,
  isCompact,
  isDisabled = false,
  onFilter,
}: {
  filters: readonly FilterDefinition[];
  firstButtonRef?: Ref<HTMLButtonElement>;
  isCompact: boolean;
  isDisabled?: boolean;
  onFilter: (filterCondition: string) => void;
}) {
  return filters.map((filter, filterIndex) => (
    <Button
      key={filter.filterName}
      ref={filterIndex === 0 ? firstButtonRef : undefined}
      size="S"
      variant="default"
      css={joinedFilterButtonCSS}
      style={isCompact ? compactButtonStyle : undefined}
      aria-label={`Filter annotations ${filter.filterName} this value`}
      isDisabled={isDisabled}
      leadingVisual={<AnnotationFilterIcon icon={filter.icon} />}
      onPress={() => onFilter(filter.filterCondition)}
    />
  ));
}

function CollapsibleAnnotationFilterActions({
  annotation,
  className,
  isOpen: controlledIsOpen,
  filters,
  onFilter,
  onOpenChange,
  targetKind,
}: {
  annotation: AnnotationTooltipFilterActionsProps["annotation"];
  className?: string;
  isOpen?: boolean;
  filters: readonly FilterDefinition[];
  onFilter: (filterCondition: string) => void;
  onOpenChange?: (isOpen: boolean) => void;
  targetKind?: AnnotationTooltipFilterActionsProps["targetKind"];
}) {
  const [uncontrolledIsOpen, setUncontrolledIsOpen] = useState(false);
  const isOpen = controlledIsOpen ?? uncontrolledIsOpen;
  const handleOpenChange = (nextIsOpen: boolean) => {
    onOpenChange?.(nextIsOpen);
    if (controlledIsOpen === undefined) {
      setUncontrolledIsOpen(nextIsOpen);
    }
  };
  const targetLabel = targetKind ? `${targetKind}s` : "annotations";
  const formattedScore =
    typeof annotation.score === "number"
      ? formatAnnotationScore(annotation.score)
      : null;

  return (
    <div
      className={classNames("annotation-filter-actions", className)}
      css={collapsibleFilterActionsCSS}
      data-open={isOpen}
    >
      <span className="annotation-filter-actions__sizer" aria-hidden="true">
        <Icon svg={<Icons.ListFilter />} />
        <span>Filter</span>
      </span>
      <MenuTrigger isOpen={isOpen} onOpenChange={handleOpenChange}>
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
          data-annotation-filter-menu
          placement="right top"
          isNonModal
          // This menu belongs to a coordinated sibling group ("filter" |
          // "more" | null): the press that dismisses it may be the press that
          // opens its sibling, so it must not consume outside interactions.
          // The enclosing annotation popover owns outside dismissal.
          closeOnInteractOutside={false}
          minHeight={0}
          minWidth={0}
          aria-label={`Filter ${targetLabel}`}
        >
          <MenuHeader>
            <MenuHeaderTitle>{`Filter ${targetLabel}`}</MenuHeaderTitle>
          </MenuHeader>
          <Menu
            aria-label={`Filter ${targetLabel} by annotation value`}
            css={annotationFilterMenuCSS}
            onAction={(action) => onFilter(String(action))}
          >
            {filters.map((filter) => (
              <MenuItem
                key={filter.filterName}
                id={filter.filterCondition}
                textValue={`${filter.menuLabel} ${formattedScore ?? annotation.label ?? ""}`.trim()}
                leadingContent={<AnnotationFilterIcon icon={filter.icon} />}
              >
                <Flex
                  className="annotation-filter-actions__sentence"
                  elementType="span"
                  alignItems="center"
                  gap="size-100"
                  minWidth={0}
                >
                  <Text>{filter.menuLabel}</Text>
                  {formattedScore != null ? (
                    <AnnotationScoreText
                      appearance="compact"
                      fontFamily="mono"
                      optimizationValue={annotation.optimizationValue}
                      title={formattedScore}
                    >
                      <span
                        className="annotation-filter-actions__score-value"
                        css={truncatedAnnotationValueCSS}
                      >
                        {formattedScore}
                      </span>
                    </AnnotationScoreText>
                  ) : annotation.label != null ? (
                    <Text
                      className="annotation-filter-actions__label-value"
                      css={truncatedAnnotationValueCSS}
                      title={annotation.label}
                    >
                      {annotation.label}
                    </Text>
                  ) : null}
                </Flex>
              </MenuItem>
            ))}
          </Menu>
        </MenuContainer>
      </MenuTrigger>
    </div>
  );
}

export function AnnotationTooltipFilterActions(
  props: AnnotationTooltipFilterActionsProps
) {
  const { appendFilterCondition } = useSpanFilters();
  const {
    annotation,
    className,
    displayMode = "expanded",
    isOpen,
    onOpenChange,
    targetKind,
  } = props;
  const filters =
    displayMode === "collapsible"
      ? getAnnotationFilterMenuDefinitions(annotation)
      : getAnnotationFilterDefinitions(annotation);

  if (filters.length === 0) {
    return null;
  }

  if (displayMode === "collapsible") {
    return (
      <CollapsibleAnnotationFilterActions
        annotation={annotation}
        className={className}
        filters={filters}
        isOpen={isOpen}
        onFilter={appendFilterCondition}
        onOpenChange={onOpenChange}
        targetKind={targetKind}
      />
    );
  }

  return (
    <Group
      aria-label="Filter annotation value"
      className={className}
      style={{ gap: 0 }}
    >
      <AnnotationFilterButtons
        filters={filters}
        isCompact
        onFilter={appendFilterCondition}
      />
    </Group>
  );
}
