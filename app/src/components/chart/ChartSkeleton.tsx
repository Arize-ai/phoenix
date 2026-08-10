import { css } from "@emotion/react";
import type { HTMLAttributes, Ref } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import { pulseAnimation } from "@phoenix/components/core/loading";
import { classNames } from "@phoenix/utils/classNames";

import { ChartResponsiveContainer } from "./ChartResponsiveContainer";
import {
  compactChartMargin,
  compactTimeXAxisProps,
  compactYAxisProps,
  defaultCartesianGridProps,
} from "./defaults";

/**
 * Mostly-low bins with a few spikes, so the skeleton reads as a chart rather
 * than uniform noise.
 */
const PLACEHOLDER_DATA = [
  15, 19, 23, 17, 88, 21, 85, 23, 96, 34, 42, 28, 64, 31, 55, 47,
].map((value) => ({ value }));

const SKELETON_FILL = "var(--global-color-gray-200)";

/** Fixed y-axis gutter wide enough for a typical 2–3 character tick ("40k") */
const Y_AXIS_WIDTH = 26;

/** Pills stand in for the tick labels of a loaded chart */
const TICK_PILL_WIDTH = 16;
const TICK_PILL_HEIGHT = 6;

interface AxisTickProps {
  x?: string | number;
  y?: string | number;
}

/** Pill placeholder for an x-axis tick label, centered on the tick */
function XAxisSkeletonTick({ x = 0, y = 0 }: AxisTickProps) {
  return (
    <rect
      x={Number(x) - TICK_PILL_WIDTH / 2}
      y={Number(y)}
      width={TICK_PILL_WIDTH}
      height={TICK_PILL_HEIGHT}
      rx={TICK_PILL_HEIGHT / 2}
      fill={SKELETON_FILL}
    />
  );
}

/** Pill placeholder for a y-axis tick label, right-aligned to the tick */
function YAxisSkeletonTick({ x = 0, y = 0 }: AxisTickProps) {
  return (
    <rect
      x={Number(x) - TICK_PILL_WIDTH}
      y={Number(y) - TICK_PILL_HEIGHT / 2}
      width={TICK_PILL_WIDTH}
      height={TICK_PILL_HEIGHT}
      rx={TICK_PILL_HEIGHT / 2}
      fill={SKELETON_FILL}
    />
  );
}

export interface ChartSkeletonProps extends HTMLAttributes<HTMLDivElement> {
  ref?: Ref<HTMLDivElement>;
}

/**
 * A static Recharts bar chart used as a loading placeholder. It shares the
 * compact margin, axis, and grid defaults with real charts, so the swap from
 * loading to loaded doesn't shift the layout. Fills its container.
 */
export function ChartSkeleton({
  className,
  ref,
  ...props
}: ChartSkeletonProps) {
  return (
    // Announce a loading status to assistive tech; the decorative chart
    // internals are hidden
    <div
      role="status"
      aria-label="loading"
      ref={ref}
      className={classNames(className, "chart-skeleton")}
      css={chartSkeletonCSS}
      {...props}
    >
      <div className="chart-skeleton__plot" aria-hidden>
        <ChartResponsiveContainer>
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
        </ChartResponsiveContainer>
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
