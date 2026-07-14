import type {
  CartesianGridProps,
  LegendProps,
  TooltipProps,
  XAxisProps,
  YAxisProps,
} from "recharts";

/**
 * Charts render horizontal gridlines only — the y scale needs the guide while
 * vertical lines just add noise. Pass `vertical` to opt back into a full grid.
 */
export const defaultCartesianGridProps: CartesianGridProps = {
  stroke: "var(--chart-cartesian-grid-stroke-color)",
  vertical: false,
};

/**
 * Chart axis text is uniformly one step below the body size so the data and
 * panel titles stay dominant. Set as an explicit pixel value (not a CSS var)
 * because Recharts measures tick labels for the y axis' `width: "auto"`
 * off-tree, where inherited styles and CSS vars don't apply — the measured
 * and rendered sizes must come from the same literal.
 */
const CHART_AXIS_FONT_SIZE = "12px";

export const defaultXAxisProps: XAxisProps = {
  stroke: "var(--chart-axis-stroke-color)",
  style: {
    fill: "var(--chart-axis-text-color)",
    fontSize: CHART_AXIS_FONT_SIZE,
  },
};

export const defaultYAxisProps: YAxisProps = {
  stroke: "var(--chart-axis-stroke-color)",
  style: {
    fill: "var(--chart-axis-text-color)",
    fontSize: CHART_AXIS_FONT_SIZE,
  },
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
  tickMargin: 2,
};

/**
 * Time x axis for compact metric charts: keeps the baseline for bars to sit
 * on but drops the tick marks and trims the reserved height.
 */
export const compactTimeXAxisProps: XAxisProps = {
  ...defaultTimeXAxisProps,
  tickLine: false,
  tickMargin: 4,
  height: 18,
};

/**
 * Category x axis for compact metric charts where each tick is a discrete
 * entity (e.g. one experiment per tick): keeps the baseline for bars to sit
 * on but drops the tick marks, matching the compact time axis treatment.
 * Category ticks are arbitrary strings (names), so unlike the numeric time
 * axis the reserved height leaves room for descenders.
 */
export const compactCategoryXAxisProps: XAxisProps = {
  ...defaultXAxisProps,
  type: "category",
  tickLine: false,
  tickMargin: 4,
  height: 24,
};

/**
 * Margin for compact metric charts. The panel supplies the real gutters, so
 * the margins stay minimal and symmetric-looking: headroom above the tallest
 * mark, a couple pixels on the left as measurement slack for the y axis'
 * auto-width tick labels (Recharts measures them with the fallback font, so
 * the widest label can otherwise clip by a pixel or two), and just enough on
 * the right for the final x tick label's overhang past the plot edge.
 */
export const compactChartMargin = {
  top: 4,
  right: 8,
  left: 2,
  bottom: 0,
};

/**
 * Shared hover cursor so every chart highlights the hovered bin the same way.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const defaultTooltipProps: TooltipProps<any, any> = {
  cursor: {
    fill: "var(--chart-tooltip-cursor-fill-color)",
  },
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

/**
 * Legend for compact metric charts: left-aligned so it shares the panel's
 * left gutter with the title and y-axis labels, and so wrapped rows read
 * top-left to bottom-right instead of leaving a right-aligned orphan row.
 * Text drops to the XS size to match the compact axes.
 */
export const compactLegendProps: LegendProps = {
  ...defaultLegendProps,
  align: "left",
  wrapperStyle: {
    userSelect: "none",
    fontSize: "var(--global-font-size-xs)",
    lineHeight: "var(--global-line-height-xs)",
    paddingTop: "var(--global-dimension-size-50)",
  },
};
