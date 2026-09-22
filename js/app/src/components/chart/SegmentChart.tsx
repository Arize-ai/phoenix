import { css } from "@emotion/react";

const segmentChartCSS = css`
  /* Half the marker's width, and its height: a low, wide tick */
  --segment-chart-marker-size: 4px;
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 3px;

  .segment-chart__bar {
    display: flex;
    flex-direction: row;
    overflow: hidden;
    /* A pill at any height; the segments inside keep square joins */
    border-radius: var(--global-rounding-full);
    gap: 2px;
  }
  &[data-track="true"] .segment-chart__bar {
    background-color: var(--global-color-gray-300);
  }
  .segment-chart__segment {
    height: 100%;
    flex-shrink: 0;
    flex-grow: 0;
  }
  /* A lane under the bar for the markers, so they take room in the layout
     rather than spilling into whatever sits below */
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
`;

export type SegmentChartProps = {
  /**
   * The height of the chart in pixels.
   * @default 6
   */
  height?: number;
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
   * Draws the bar's background so that segments adding up to less than the
   * total read as a fraction of a whole rather than as a short bar.
   * @default false
   */
  showTrack?: boolean;
  /**
   * Values at which to draw a tick under the bar, e.g. where one half of a
   * total ends and the other begins. Ticks at or beyond either end are left
   * out, since there is nothing to separate there.
   */
  markerValues?: number[];
  /**
   * Keeps the lane under the bar even when there is no marker to draw in it,
   * so a bar whose markers are not yet known stands as tall as one whose are.
   * @default false
   */
  showMarkerLane?: boolean;
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

export const SegmentChart = ({
  height = 6,
  minimumSegmentPercentage = 0,
  showTrack = false,
  markerValues,
  showMarkerLane = false,
  segments,
  totalValue: _totalValue,
}: SegmentChartProps) => {
  // if the total value is not provided, we calculate it from the segments
  // this is useful for cases where the total value is not known ahead of time
  const totalValue =
    _totalValue ?? segments.reduce((acc, segment) => acc + segment.value, 0);
  const visibleSegments =
    minimumSegmentPercentage > 0
      ? segments.filter((segment) => segment.value > 0)
      : segments;
  const hasSegments = visibleSegments.some((segment) => segment.value > 0);
  // An all-zero breakdown has nothing to draw, and a bar of pure background
  // reads as a rendering failure rather than as an empty total. A track is
  // the exception: an empty track is how a zero share of a whole looks.
  if (!hasSegments && !showTrack) {
    return null;
  }
  const markers = (markerValues ?? []).filter(
    (value) => value > 0 && value < totalValue
  );

  return (
    <div className="segment-chart" css={segmentChartCSS} data-track={showTrack}>
      <div className="segment-chart__bar" style={{ height: `${height}px` }}>
        {visibleSegments.map((segment) => {
          const percentage =
            totalValue > 0 ? (segment.value / totalValue) * 100 : 0;
          const color = segment.color;
          const minimumWidth =
            segment.value > 0 && minimumSegmentPercentage > 0
              ? `${minimumSegmentPercentage}%`
              : undefined;
          return (
            <div
              key={segment.name}
              className="segment-chart__segment"
              style={{
                width: `${percentage}%`,
                minWidth: minimumWidth,
                flexShrink: minimumWidth == null ? 0 : 1,
                backgroundColor: color,
              }}
            />
          );
        })}
      </div>
      {markers.length > 0 || showMarkerLane ? (
        <div className="segment-chart__markers" aria-hidden="true">
          {markers.map((value) => (
            <div
              key={value}
              className="segment-chart__marker"
              style={{ left: `${(value / totalValue) * 100}%` }}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
};
