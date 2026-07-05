import type { CSSProperties } from "react";
import type {
  CartesianGridProps,
  LabelProps,
  LegendProps,
  TooltipProps,
  XAxisProps,
  YAxisProps,
} from "recharts";

import { NON_MODAL_FLOATING_Z_INDEX } from "@phoenix/components/core/zIndex";

export const defaultCartesianGridProps: CartesianGridProps = {
  strokeDasharray: "4 4",
  stroke: "var(--chart-cartesian-grid-stroke-color)",
};

export const defaultXAxisProps: XAxisProps = {
  stroke: "var(--chart-axis-stroke-color)",
  style: { fill: "var(--chart-axis-text-color)" },
};

export const defaultYAxisProps: YAxisProps = {
  stroke: "var(--chart-axis-stroke-color)",
  style: { fill: "var(--chart-axis-text-color)" },
};

const TIME_AXIS_EDGE_PADDING = 8;

/**
 * Default props for a time-binned numeric XAxis. Recharts thins ticks based on
 * actual rendered pixel width via `minTickGap`, so density adapts to the chart's
 * size automatically — callers should not pass `interval` based on data length.
 * Pixel padding keeps centered bars and active line dots from clipping against
 * the first and last x-axis ticks.
 */
export const defaultTimeXAxisProps: XAxisProps = {
  ...defaultXAxisProps,
  dataKey: "timestamp",
  type: "number",
  scale: "time",
  interval: "preserveStartEnd",
  minTickGap: 50,
  padding: { left: TIME_AXIS_EDGE_PADDING, right: TIME_AXIS_EDGE_PADDING },
};

/**
 * Y axis for compact metric charts: the width hugs the tick labels instead of
 * reserving a fixed gutter, and the axis/tick lines are dropped so the
 * gridlines carry the scale. Encode the unit in the tick formatter (e.g.
 * "$3", "1.2s", "40k") rather than in a rotated axis label — the label eats
 * horizontal space the plot needs and restates the chart title.
 */
export const compactYAxisProps: YAxisProps = {
  ...defaultYAxisProps,
  width: "auto",
  axisLine: false,
  tickLine: false,
  tickMargin: 4,
};

/**
 * Time x axis for compact metric charts: keeps the baseline for bars to sit
 * on but drops the tick marks and trims the reserved height.
 */
export const compactTimeXAxisProps: XAxisProps = {
  ...defaultTimeXAxisProps,
  tickLine: false,
  tickMargin: 6,
  height: 24,
};

/**
 * Margin for compact metric charts: headroom above the tallest mark, right
 * margin so the final x tick label doesn't clip against the panel edge. The
 * left gutter comes entirely from the y axis' auto width.
 */
export const compactChartMargin = {
  top: 4,
  right: 18,
  left: 0,
  bottom: 0,
};

export const defaultSelectedTimestampReferenceLineProps = {
  stroke: "var(--global-color-gray-900)",
};

export const defaultSelectedTimestampReferenceLineLabelProps: LabelProps = {
  value: "▼",
  position: "top",
  style: {
    fill: "#fabe32",
    fontSize: "var(--global-font-size-xs)",
  },
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const defaultBarChartTooltipProps: TooltipProps<any, any> = {
  cursor: {
    fill: "var(--global-color-gray-300)",
  },
};

export const defaultChartTooltipWrapperStyle: CSSProperties = {
  zIndex: NON_MODAL_FLOATING_Z_INDEX,
};

export const defaultLegendProps: LegendProps = {
  align: "right",
  wrapperStyle: {
    userSelect: "none",
  },
  formatter: (value) => (
    <span
      style={{
        color: "var(--chart-legend-text-color)",
        userSelect: "none",
      }}
    >
      {value}
    </span>
  ),
};
