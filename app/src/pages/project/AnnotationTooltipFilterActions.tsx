import type { CSSProperties } from "react";

import { Group, Icon, IconButton, Icons } from "@phoenix/components";

import { useSpanFilters } from "./SpanFiltersContext";

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
  icon: "equal" | "greater-than" | "less-than" | "not-equal";
};

const compactIconButtonStyle: CSSProperties = {
  width: "var(--global-dimension-size-300)",
  minWidth: "var(--global-dimension-size-300)",
  height: "var(--global-dimension-size-300)",
  minHeight: "var(--global-dimension-size-300)",
};

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

export function AnnotationTooltipFilterActions(
  props: AnnotationTooltipFilterActionsProps
) {
  const { appendFilterCondition } = useSpanFilters();
  const { annotation, className } = props;
  const filters = getAnnotationFilterDefinitions(annotation);

  if (filters.length === 0) {
    return null;
  }

  return (
    <Group
      aria-label="Filter annotation value"
      className={className}
      style={{ gap: "var(--global-dimension-size-25)" }}
    >
      {filters.map((filter) => (
        <IconButton
          key={filter.filterName}
          size="S"
          style={compactIconButtonStyle}
          aria-label={`Filter annotations ${filter.filterName} this value`}
          onPress={() => {
            appendFilterCondition(filter.filterCondition);
          }}
        >
          <AnnotationFilterIcon icon={filter.icon} />
        </IconButton>
      ))}
    </Group>
  );
}
