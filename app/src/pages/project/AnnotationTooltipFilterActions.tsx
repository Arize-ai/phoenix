import { css } from "@emotion/react";
import type { CSSProperties, FocusEvent, Ref } from "react";
import { useId, useRef, useState } from "react";

import { Button, Group, Icon, Icons } from "@phoenix/components";
import { classNames } from "@phoenix/utils/classNames";

import { useSpanFilters } from "./SpanFiltersContext";

type AnnotationTooltipFilterActionsProps = {
  className?: string;
  displayMode?: "collapsible" | "expanded";
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
  icon: "equal" | "greater-than" | "less-than" | "not-equal";
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
  display: inline-block;
  flex: none;
  width: var(--global-button-height-s);
  height: var(--global-button-height-s);
  overflow: visible;

  .annotation-filter-actions__trigger {
    width: 100%;
    opacity: 1;
  }

  .annotation-filter-actions__options {
    position: absolute;
    top: 0;
    right: 0;
    display: flex;
    align-items: center;
    width: max-content;
    gap: 0;
    visibility: hidden;
    pointer-events: none;
  }

  &[data-expanded="true"] {
    .annotation-filter-actions__trigger {
      opacity: 0;
      pointer-events: none;
    }

    .annotation-filter-actions__options {
      visibility: visible;
      pointer-events: auto;
    }
  }

  &:has(.annotation-filter-actions__trigger[data-focus-visible]) {
    border-radius: var(--global-rounding-small);
    outline: var(--focus-ring-thickness) solid var(--focus-ring-color);
    outline-offset: var(--focus-ring-offset);
  }
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
      },
      {
        filterName: "less than",
        filterCondition: `annotations['${name}'].score < ${score}`,
        icon: "less-than",
      },
      {
        filterName: "equals",
        filterCondition: `annotations['${name}'].score == ${score}`,
        icon: "equal",
      },
    ];
  }
  if (label != null) {
    return [
      {
        filterName: "matches",
        filterCondition: `annotations['${name}'].label == "${label}"`,
        icon: "equal",
      },
      {
        filterName: "does not match",
        filterCondition: `annotations['${name}'].label != "${label}"`,
        icon: "not-equal",
      },
    ];
  }
  return [];
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
  className,
  filters,
  onFilter,
}: {
  className?: string;
  filters: readonly FilterDefinition[];
  onFilter: (filterCondition: string) => void;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const [hasFocusWithin, setHasFocusWithin] = useState(false);
  const firstFilterButtonRef = useRef<HTMLButtonElement>(null);
  const filterOptionsId = useId();
  const isExpanded = isHovered || hasFocusWithin;
  const handleBlur = (event: FocusEvent<HTMLDivElement>) => {
    if (
      !(event.relatedTarget instanceof Node) ||
      !event.currentTarget.contains(event.relatedTarget)
    ) {
      setHasFocusWithin(false);
    }
  };

  return (
    <div
      role="group"
      aria-label="Filter annotation value"
      className={classNames("annotation-filter-actions", className)}
      css={collapsibleFilterActionsCSS}
      data-expanded={isExpanded}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onFocusCapture={() => setHasFocusWithin(true)}
      onBlurCapture={handleBlur}
    >
      <Button
        className="annotation-filter-actions__trigger"
        size="S"
        variant="quiet"
        aria-label="Show annotation filters"
        aria-controls={filterOptionsId}
        aria-expanded={isExpanded}
        leadingVisual={<Icon svg={<Icons.ListFilter />} />}
        onPress={() => firstFilterButtonRef.current?.focus()}
      />
      <div
        id={filterOptionsId}
        className="annotation-filter-actions__options"
        aria-hidden={!isExpanded}
      >
        <AnnotationFilterButtons
          filters={filters}
          firstButtonRef={firstFilterButtonRef}
          isCompact={false}
          isDisabled={!isExpanded}
          onFilter={onFilter}
        />
      </div>
    </div>
  );
}

export function AnnotationTooltipFilterActions(
  props: AnnotationTooltipFilterActionsProps
) {
  const { appendFilterCondition } = useSpanFilters();
  const { annotation, className, displayMode = "expanded" } = props;
  const filters = getAnnotationFilterDefinitions(annotation);

  if (filters.length === 0) {
    return null;
  }

  if (displayMode === "collapsible") {
    return (
      <CollapsibleAnnotationFilterActions
        className={className}
        filters={filters}
        onFilter={appendFilterCondition}
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
