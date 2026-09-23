import { css } from "@emotion/react";
import type { ReactNode } from "react";

import { classNames } from "@phoenix/utils/classNames";

import { Icon, Icons } from "../core/icon";

/**
 * The visual archetype of a chart, used to render a small preview glyph so a
 * chart can be recognized by its shape (vertical bars, a ranked horizontal
 * "top N" chart, or a line) before it is added to a view.
 */
export type ChartTypeIconType = "bar" | "barHorizontal" | "line";

export interface ChartTypeIconProps {
  /**
   * The chart archetype to preview.
   */
  type: ChartTypeIconType;
  /**
   * The size of the (square) chip in pixels.
   * @default 24
   */
  size?: number;
  className?: string;
}

const CHART_TYPE_GLYPHS: Record<ChartTypeIconType, ReactNode> = {
  bar: <Icons.ChartNoAxesColumn />,
  barHorizontal: <Icons.ChartBarDecreasing />,
  line: <Icons.ChartLine />,
};

/**
 * Human-readable labels for each chart archetype, useful for tooltips and
 * accessible descriptions.
 */
export const CHART_TYPE_LABELS: Record<ChartTypeIconType, string> = {
  bar: "Bar chart",
  barHorizontal: "Ranked bar chart",
  line: "Line chart",
};

const chartTypeIconCSS = css`
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--global-rounding-medium);
  /* Quiet outlined chip that reads as part of the text row rather than a hard
     filled box: the title stays the loudest element, the glyph matches the
     description. */
  border: var(--global-border-size-thin) solid
    var(--global-border-color-default);
  color: var(--global-text-color-700);
`;

/**
 * A small preview of a chart's shape, rendered as a rounded chip with a Lucide
 * chart glyph so the reader can tell a vertical bar chart from a ranked
 * horizontal chart or a line chart at a glance — independent of the chart's
 * series colors. The chip is tuned to sit quietly next to a title/description
 * pair.
 */
export function ChartTypeIcon({
  type,
  size = 24,
  className,
}: ChartTypeIconProps) {
  return (
    <span
      className={classNames(
        "chart-type-icon",
        `chart-type-icon--${type}`,
        className
      )}
      css={chartTypeIconCSS}
      // Drive the glyph size off the chip size; Icon renders at 1.2em, so this
      // keeps the glyph at roughly half of the chip.
      style={{ width: size, height: size, fontSize: Math.round(size * 0.5) }}
      aria-hidden
    >
      <Icon svg={CHART_TYPE_GLYPHS[type]} />
    </span>
  );
}
