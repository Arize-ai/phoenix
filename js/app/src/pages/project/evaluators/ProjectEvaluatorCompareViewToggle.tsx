import { css } from "@emotion/react";

import { ToggleButton, ToggleButtonGroup } from "@phoenix/components";
import type { AnnotationMetricsView } from "@phoenix/components/chart/annotationMetricsUtils";

const VIEWS: ReadonlyArray<{ view: AnnotationMetricsView; label: string }> = [
  { view: "scores", label: "Scores" },
  { view: "labels", label: "Labels" },
];

/**
 * The row above each comparison plot, holding what names the plot on the left
 * and its view toggle on the right. Every chart on the page uses it, so the
 * toggles and the plots below them line up across the row.
 */
export const compareChartToolbarCSS = css`
  display: flex;
  flex: none;
  align-items: center;
  justify-content: space-between;
  gap: var(--global-dimension-size-100);
  min-width: 0;
  min-height: var(--global-button-height-s);
`;

/**
 * The row under each comparison plot: the time chart's legend, or a
 * distribution's mean score. One height for both, so the plots above
 * them end at the same line; tall enough for a tinted score.
 */
export const compareChartFooterCSS = css`
  display: flex;
  flex: none;
  align-items: center;
  min-width: 0;
  min-height: var(--global-dimension-size-300);
`;

/**
 * Plot margins shared by every comparison chart, so their gridlines start and
 * end at the same height across the row. The bottom margin keeps x axis tick
 * labels, which render just past the axis height, inside the chart.
 */
export const COMPARE_CHART_MARGIN = { top: 8, right: 8, left: 2, bottom: 4 };

/** Width of a comparison chart's y axis with a name set along it. */
export const COMPARE_LABELED_Y_AXIS_WIDTH = 56;

/**
 * Names a comparison chart's y axis: set along the axis, in the axis text
 * color, reading bottom to top on the left and top to bottom on the right.
 */
export function getCompareYAxisLabel({
  value,
  orientation = "left",
}: {
  value: string;
  orientation?: "left" | "right";
}) {
  return {
    value,
    angle: orientation === "left" ? -90 : 90,
    position: orientation === "left" ? "insideLeft" : "insideRight",
    fontSize: 11,
    fill: "var(--chart-axis-text-color)",
    style: { textAnchor: "middle" },
  } as const;
}

/**
 * Switches a comparison chart between scores and labels. Both options always
 * show, so the toggle sits in the same place for every evaluator; a view the
 * results cannot support is disabled rather than hidden.
 */
export function ProjectEvaluatorCompareViewToggle({
  view,
  availableViews,
  onViewChange,
  "aria-label": ariaLabel,
}: {
  view: AnnotationMetricsView;
  availableViews: ReadonlyArray<AnnotationMetricsView>;
  onViewChange: (view: AnnotationMetricsView) => void;
  "aria-label": string;
}) {
  return (
    <ToggleButtonGroup
      aria-label={ariaLabel}
      size="S"
      selectionMode="single"
      disallowEmptySelection
      selectedKeys={[view]}
      onSelectionChange={(keys) => {
        const [next] = keys;
        if (next === "scores" || next === "labels") onViewChange(next);
      }}
    >
      {VIEWS.map((option) => (
        <ToggleButton
          key={option.view}
          id={option.view}
          isDisabled={!availableViews.includes(option.view)}
        >
          {option.label}
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  );
}
