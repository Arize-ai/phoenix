import { css } from "@emotion/react";
import type { CSSProperties } from "react";

import {
  pulseAnimation,
  skeletonFillCSS,
} from "@phoenix/components/core/loading";
import { classNames } from "@phoenix/utils/classNames";

/** The space between neighboring segments, in pixels. */
const SEGMENT_GAP = 2;

/** How near a boundary a marker must fall, as a share of the total, to sit in the gap. */
const BOUNDARY_EPSILON = 1e-9;

/**
 * Bar height when neither the `height` prop nor `--segment-chart-height` on
 * an ancestor sets one.
 */
const DEFAULT_HEIGHT = 6;

const segmentChartCSS = css`
  --segment-chart-marker-size: 4px;
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 3px;

  .segment-chart__bar {
    display: flex;
    flex-direction: row;
    height: var(--segment-chart-height, ${DEFAULT_HEIGHT}px);
    overflow: hidden;
    border-radius: var(--global-rounding-xsmall);
    gap: ${SEGMENT_GAP}px;
  }
  &[data-track="true"] .segment-chart__bar {
    background-color: var(--global-color-gray-300);
  }
  .segment-chart__segment {
    height: 100%;
    flex: none;
  }
  /* In flow, so the markers take room rather than spilling into what follows */
  .segment-chart__markers {
    position: relative;
    height: var(--segment-chart-marker-size);
  }
  .segment-chart__marker {
    position: absolute;
    top: 0;
    transform: translateX(-50%);
    width: 0;
    height: 0;
    border-left: var(--segment-chart-marker-size) solid transparent;
    border-right: var(--segment-chart-marker-size) solid transparent;
    border-bottom: var(--segment-chart-marker-size) solid
      var(--global-text-color-900);
  }

  &.segment-chart--skeleton {
    ${pulseAnimation}
    .segment-chart__segment {
      ${skeletonFillCSS}
      width: 100%;
    }
  }
`;

type SegmentChartSizingProps = {
  /**
   * The height of the bar in pixels. Overrides `--segment-chart-height` set
   * on an ancestor; when neither is given the bar is 6px.
   */
  height?: number;
  /**
   * Keeps the lane under the bar even when there is no marker to draw in it,
   * so a bar whose markers are not yet known stands as tall as one whose are.
   * @default false
   */
  showMarkerLane?: boolean;
  /**
   * Draws the bar's background so that segments adding up to less than the
   * total read as a fraction of a whole rather than as a short bar.
   * @default false
   */
  showTrack?: boolean;
};

export type SegmentChartProps = SegmentChartSizingProps & {
  /**
   * The total value of the chart
   */
  totalValue?: number;
  /**
   * The minimum width of a non-zero segment as a percentage of the chart.
   * @default 0
   */
  minimumSegmentPercentage?: number;
  /**
   * Values at which to draw a tick under the bar, e.g. where one half of a
   * total ends and the other begins. Ticks at or beyond either end are left
   * out, since there is nothing to separate there.
   */
  markerValues?: number[];
  /**
   * The segments to display in the chart
   */
  segments: {
    /**
     * The name of the segment
     */
    name: string;
    /**
     * The value of the segment
     */
    value: number;
    /**
     * the color for the segment
     */
    color: string;
  }[];
};

/**
 * Each segment's share of the bar's fillable width: its value's share of the
 * total, with slivers widened to the minimum at the expense of the segments
 * above it, in proportion to their size.
 */
function getSegmentFractions({
  values,
  totalValue,
  minimumFraction,
}: {
  values: number[];
  totalValue: number;
  minimumFraction: number;
}): number[] {
  const fractions = values.map((value) =>
    totalValue > 0 ? value / totalValue : 0
  );
  if (minimumFraction <= 0) {
    return fractions;
  }
  const isSliver = fractions.map(
    (fraction) => fraction > 0 && fraction < minimumFraction
  );
  const widening = fractions.reduce(
    (acc, fraction, index) =>
      acc + (isSliver[index] ? minimumFraction - fraction : 0),
    0
  );
  const rest = fractions.reduce(
    (acc, fraction, index) => acc + (isSliver[index] ? 0 : fraction),
    0
  );
  return fractions.map((fraction, index) => {
    if (isSliver[index]) {
      return minimumFraction;
    }
    return rest > 0 ? fraction * (1 - widening / rest) : fraction;
  });
}

/**
 * Where a value falls along the laid-out bar: how far across the fillable
 * width, and how many gaps lie before it. A value on the boundary between two
 * segments falls in the middle of the gap between them.
 */
function getMarkerPosition({
  value,
  values,
  fractions,
  totalValue,
}: {
  value: number;
  values: number[];
  fractions: number[];
  totalValue: number;
}): { fraction: number; gaps: number } {
  let fraction = 0;
  let segmentStart = 0;
  for (let index = 0; index < values.length; index += 1) {
    const segmentEnd = segmentStart + values[index];
    const isLast = index === values.length - 1;
    if (Math.abs(value - segmentEnd) <= BOUNDARY_EPSILON * totalValue) {
      return {
        fraction: fraction + fractions[index],
        gaps: isLast ? index : index + 0.5,
      };
    }
    if (value < segmentEnd) {
      const within =
        values[index] > 0 ? (value - segmentStart) / values[index] : 0;
      return { fraction: fraction + fractions[index] * within, gaps: index };
    }
    fraction += fractions[index];
    segmentStart = segmentEnd;
  }
  const rest = totalValue > 0 ? (value - segmentStart) / totalValue : 0;
  return { fraction: fraction + rest, gaps: Math.max(values.length - 1, 0) };
}

function getSizingStyle(height: number | undefined): CSSProperties | undefined {
  return height != null
    ? ({ "--segment-chart-height": `${height}px` } as CSSProperties)
    : undefined;
}

/**
 * One whole, drawn as a bar split into its parts.
 *
 * Answers "how does this quantity divide?" for a single quantity: a span's
 * tokens into prompt and completion, a message's usage by token type, a
 * share of a total as a thin bar under a number. It is a building block. It
 * draws no label, legend or number of its own, so the caller places those
 * beside it and chooses the colors.
 *
 * When the same parts are measured more than one way, tokens and cost, say,
 * and the point is to compare one measure's split with another's, use
 * {@link BreakdownBars}, which lines up one of these per measure with a
 * label and total each and keeps the segments aligned across them.
 *
 * - `segments` are the parts, in order; each has a color, and slivers can be
 *   held to a minimum width so they stay visible.
 * - `totalValue` is the whole. When the parts add up to less, `showTrack`
 *   draws the remainder as a track, so the parts read as a share of the
 *   whole rather than as a short bar.
 * - `markerValues` put a tick under the bar at a value worth pointing at,
 *   such as where the prompt ends and the completion begins.
 * - Height comes from `--segment-chart-height` on an ancestor, so a parent
 *   sizes every bar it holds at once, or from the `height` prop.
 */
export const SegmentChart = ({
  height,
  minimumSegmentPercentage = 0,
  showTrack = false,
  markerValues,
  showMarkerLane = false,
  segments,
  totalValue: _totalValue,
}: SegmentChartProps) => {
  const totalValue =
    _totalValue ?? segments.reduce((acc, segment) => acc + segment.value, 0);
  const visibleSegments = segments.filter((segment) => segment.value > 0);
  // Nothing to draw, and a bar of pure background reads as a rendering
  // failure. A track is the exception: an empty track is how zero looks.
  if (visibleSegments.length === 0 && !showTrack) {
    return null;
  }
  const values = visibleSegments.map((segment) => segment.value);
  const fractions = getSegmentFractions({
    values,
    totalValue,
    minimumFraction: minimumSegmentPercentage / 100,
  });
  const totalGap = SEGMENT_GAP * Math.max(visibleSegments.length - 1, 0);
  const fillableWidth = `(100% - ${totalGap}px)`;
  const markers = (markerValues ?? []).filter(
    (value) => value > 0 && value < totalValue
  );

  return (
    <div
      className="segment-chart"
      css={segmentChartCSS}
      style={getSizingStyle(height)}
      data-track={showTrack}
    >
      <div className="segment-chart__bar">
        {visibleSegments.map((segment, index) => (
          <div
            key={segment.name}
            className="segment-chart__segment"
            style={{
              width: `calc(${fillableWidth} * ${fractions[index]})`,
              backgroundColor: segment.color,
            }}
          />
        ))}
      </div>
      {markers.length > 0 || showMarkerLane ? (
        <div className="segment-chart__markers" aria-hidden="true">
          {markers.map((value, index) => {
            const { fraction, gaps } = getMarkerPosition({
              value,
              values,
              fractions,
              totalValue,
            });
            return (
              <div
                key={index}
                className="segment-chart__marker"
                style={{
                  left: `calc(${fillableWidth} * ${fraction} + ${gaps * SEGMENT_GAP}px)`,
                }}
              />
            );
          })}
        </div>
      ) : null}
    </div>
  );
};

export type SegmentChartSkeletonProps = SegmentChartSizingProps & {
  className?: string;
};

/**
 * A {@link SegmentChart} whose segments have yet to load: one full-width
 * skeleton segment in the bar, on the chart's own geometry, so the loaded
 * chart takes exactly the room this did.
 */
export function SegmentChartSkeleton({
  height,
  showMarkerLane = false,
  showTrack = false,
  className,
}: SegmentChartSkeletonProps) {
  return (
    <div
      className={classNames(
        "segment-chart",
        "segment-chart--skeleton",
        className
      )}
      css={segmentChartCSS}
      style={getSizingStyle(height)}
      data-track={showTrack}
      aria-hidden="true"
    >
      <div className="segment-chart__bar">
        <div className="segment-chart__segment" />
      </div>
      {showMarkerLane ? <div className="segment-chart__markers" /> : null}
    </div>
  );
}
