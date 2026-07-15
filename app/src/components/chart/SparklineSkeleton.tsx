import { css } from "@emotion/react";
import type { HTMLAttributes, Ref } from "react";

import { Skeleton } from "@phoenix/components/core/loading";
import type { SkeletonProps } from "@phoenix/components/core/loading";
import { classNames } from "@phoenix/utils/classNames";

const DEFAULT_BAR_HEIGHTS = [
  "15%",
  "19%",
  "23%",
  "17%",
  "88%",
  "21%",
  "85%",
  "23%",
  "96%",
] as const;

type CSSLength = number | string;

export interface SparklineSkeletonProps extends HTMLAttributes<HTMLDivElement> {
  /**
   * Skeleton animation.
   * @default "wave"
   */
  animation?: SkeletonProps["animation"];
  /**
   * Bar heights within the plot area. Numbers are treated as pixels.
   */
  barHeights?: readonly CSSLength[];
  /**
   * Bar width. Numbers are treated as pixels.
   * @default 10
   */
  barWidth?: SkeletonProps["width"];
  /**
   * Number of horizontal grid lines.
   * @default 3
   */
  gridLineCount?: number;
  /**
   * Overall skeleton height. Numbers are treated as pixels.
   * @default "100%"
   */
  height?: CSSLength;
  /**
   * Reserved height for the x-axis area. Numbers are treated as pixels.
   */
  xAxisHeight?: CSSLength;
  /**
   * Reserved width for the y-axis area. Numbers are treated as pixels.
   */
  yAxisWidth?: CSSLength;
  ref?: Ref<HTMLDivElement>;
}

function getCSSLength(value: CSSLength): string {
  return typeof value === "number" ? `${value}px` : value;
}

/**
 * Renders a compact bar-chart skeleton that preserves sparkline layout.
 * @param props - sparkline skeleton props
 * @param props.animation - skeleton animation
 * @param props.barHeights - bar heights within the plot area
 * @param props.barWidth - bar width
 * @param props.gridLineCount - number of horizontal grid lines
 * @param props.height - overall skeleton height
 * @param props.xAxisHeight - reserved height for the x-axis area
 * @param props.yAxisWidth - reserved width for the y-axis area
 */
export function SparklineSkeleton({
  animation = "wave",
  barHeights = DEFAULT_BAR_HEIGHTS,
  barWidth = 10,
  className,
  gridLineCount = 3,
  height = "100%",
  ref,
  xAxisHeight = "var(--global-dimension-size-200)",
  yAxisWidth = "var(--global-dimension-size-300)",
  "aria-hidden": ariaHidden = true,
  ...props
}: SparklineSkeletonProps) {
  return (
    <div
      aria-hidden={ariaHidden}
      ref={ref}
      className={classNames(className, "sparkline-skeleton")}
      css={[
        sparklineSkeletonCSS,
        css`
          height: ${getCSSLength(height)};
          --sparkline-skeleton-x-axis-height: ${getCSSLength(xAxisHeight)};
          --sparkline-skeleton-y-axis-width: ${getCSSLength(yAxisWidth)};
        `,
      ]}
      {...props}
    >
      <div className="sparkline-skeleton__grid">
        {Array.from({ length: Math.max(gridLineCount, 0) }, (_, lineIndex) => (
          <span key={lineIndex} className="sparkline-skeleton__grid-line" />
        ))}
      </div>
      <div className="sparkline-skeleton__bars">
        {barHeights.map((barHeight, barIndex) => (
          <div key={barIndex} className="sparkline-skeleton__bar">
            <Skeleton
              width={barWidth}
              height={barHeight}
              borderRadius="XS"
              animation={animation}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

const sparklineSkeletonCSS = css`
  position: relative;
  width: 100%;
  min-width: 0;

  .sparkline-skeleton__grid {
    position: absolute;
    inset: var(--global-dimension-size-50) var(--global-dimension-size-50)
      var(--sparkline-skeleton-x-axis-height) 0;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  }

  .sparkline-skeleton__grid-line {
    height: 1px;
    border-top: 1px dashed var(--chart-cartesian-grid-stroke-color);
  }

  .sparkline-skeleton__bars {
    position: absolute;
    inset: var(--global-dimension-size-50) var(--global-dimension-size-50)
      var(--sparkline-skeleton-x-axis-height)
      var(--sparkline-skeleton-y-axis-width);
    display: grid;
    grid-auto-flow: column;
    grid-auto-columns: minmax(0, 1fr);
    align-items: end;
  }

  .sparkline-skeleton__bar {
    display: flex;
    justify-content: center;
    align-items: end;
    min-width: 0;
    height: 100%;
  }
`;
