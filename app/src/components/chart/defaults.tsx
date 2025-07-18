import {
  CartesianGridProps,
  LabelProps,
  TooltipProps,
  XAxisProps,
  YAxisProps,
} from "recharts";

/**
 * Re-usable default props for the XAxis component.
 */
export const defaultTimeXAxisProps: XAxisProps = {
  dataKey: "timestamp",
  stroke: "var(--ac-global-colo-grey-400)",
  style: { fill: "var(--ac-global-text-color-700)" },
  scale: "time",
  type: "number",
  domain: ["auto", "auto"],
  padding: "gap",
};

export const defaultSelectedTimestampReferenceLineProps = {
  stroke: "var(--ac-global-color-grey-900)",
};

export const defaultSelectedTimestampReferenceLineLabelProps: LabelProps = {
  value: "▼",
  position: "top",
  style: {
    fill: "#fabe32",
    fontSize: "var(--ac-global-font-size-xs)",
  },
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const defaultBarChartTooltipProps: TooltipProps<any, any> = {
  cursor: {
    fill: "var(--ac-global-color-grey-300)",
  },
};

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
