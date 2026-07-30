import { css } from "@emotion/react";
import type { HTMLAttributes, Ref } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";

import { pulseAnimation } from "@phoenix/components/core/loading";
import { classNames } from "@phoenix/utils/classNames";

import {
  compactChartMargin,
  compactTimeXAxisProps,
  compactYAxisProps,
  defaultCartesianGridProps,
} from "./defaults";

/**
 * Placeholder series shaped like a typical activity time series: mostly low
 * bins with a few spikes, so the skeleton reads as "a chart is coming" rather
 * than uniform noise.
 */
const PLACEHOLDER_DATA = [
  15, 19, 23, 17, 88, 21, 85, 23, 96, 34, 42, 28, 64, 31, 55, 47,
].map((value) => ({ value }));

const SKELETON_FILL = "var(--global-color-gray-200)";

/**
 * Fixed y-axis gutter standing in for the auto-width tick labels of a loaded
 * chart — wide enough for a typical 2–3 character tick (e.g. "40k").
 */
const Y_AXIS_WIDTH = 26;

interface AxisTickProps {
  x?: string | number;
  y?: string | number;
}

/**
 * Skeleton stand-in for an x-axis tick label: a small pill centered on the
 * tick position, where a loaded chart renders tick text.
 */
function XAxisSkeletonTick({ x = 0, y = 0 }: AxisTickProps) {
  return (
    <rect
      x={Number(x) - 8}
      y={Number(y)}
      width={16}
      height={6}
      rx={3}
      fill={SKELETON_FILL}
    />
  );
}

/**
 * Skeleton stand-in for a y-axis tick label: a small pill ending at the tick
 * position, matching the right-aligned tick text of a loaded chart.
 */
function YAxisSkeletonTick({ x = 0, y = 0 }: AxisTickProps) {
  return (
    <rect
      x={Number(x) - 16}
      y={Number(y) - 3}
      width={16}
      height={6}
      rx={3}
      fill={SKELETON_FILL}
    />
  );
}

export interface ChartSkeletonProps extends HTMLAttributes<HTMLDivElement> {
  ref?: Ref<HTMLDivElement>;
}

/**
 * Renders a real (static, non-interactive) Recharts bar chart as a loading
 * placeholder. It shares the compact chart margin, axis, and grid defaults
 * with the loaded charts, so the skeleton's plot area, gridlines, and axis
 * gutters sit exactly where the real chart's will — the swap from loading to
 * loaded doesn't shift the layout. Fills its container; size it with the
 * parent.
 */
export function ChartSkeleton({
  className,
  ref,
  ...props
}: ChartSkeletonProps) {
  return (
    // The placeholder chart is purely decorative, so assistive tech gets a
    // loading status (matching the Loading spinner this replaces) and the
    // decorative internals are hidden
    <div
      role="status"
      aria-label="loading"
      ref={ref}
      className={classNames(className, "chart-skeleton")}
      css={chartSkeletonCSS}
      {...props}
    >
      <div className="chart-skeleton__plot" aria-hidden>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={PLACEHOLDER_DATA}
            margin={compactChartMargin}
            barSize={10}
            accessibilityLayer={false}
          >
            <XAxis
              {...compactTimeXAxisProps}
              dataKey={undefined}
              type="category"
              scale="band"
              interval={3}
              tick={XAxisSkeletonTick}
            />
            <YAxis
              {...compactYAxisProps}
              width={Y_AXIS_WIDTH}
              domain={[0, 100]}
              ticks={[0, 50, 100]}
              tick={YAxisSkeletonTick}
            />
            <CartesianGrid {...defaultCartesianGridProps} />
            <Bar
              dataKey="value"
              fill={SKELETON_FILL}
              radius={[2, 2, 0, 0]}
              isAnimationActive={false}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="chart-skeleton__legend" aria-hidden>
        {Array.from({ length: 2 }, (_, itemIndex) => (
          <span key={itemIndex} className="chart-skeleton__legend-item">
            <span className="chart-skeleton__legend-icon" />
            <span className="chart-skeleton__legend-label" />
          </span>
        ))}
      </div>
    </div>
  );
}

const chartSkeletonCSS = css`
  position: relative;
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  min-width: 0;
  /* Pulse only the painted shapes (bars, ticks, grid); the panel chrome
     around the skeleton stays steady */
  ${pulseAnimation}

  .chart-skeleton__plot {
    flex: 1 1 auto;
    min-height: 0;
  }

  .chart-skeleton__legend {
    flex: none;
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: var(--global-dimension-size-150);
    padding-top: var(--global-dimension-size-50);
    line-height: var(--global-line-height-xs);
  }

  .chart-skeleton__legend-item {
    display: inline-flex;
    align-items: center;
    gap: var(--global-dimension-size-50);
  }

  .chart-skeleton__legend-icon {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background-color: ${SKELETON_FILL};
  }

  .chart-skeleton__legend-label {
    width: 28px;
    height: 6px;
    border-radius: 3px;
    background-color: ${SKELETON_FILL};
  }
`;
