import type {
  CartesianGridProps,
  LabelProps,
  LegendProps,
  TooltipProps,
  XAxisProps,
  YAxisProps,
} from "recharts";

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

export const defaultLegendProps: LegendProps = {
  align: "right",
  formatter: (value) => (
    <span style={{ color: "var(--chart-legend-text-color)" }}>{value}</span>
  ),
};
