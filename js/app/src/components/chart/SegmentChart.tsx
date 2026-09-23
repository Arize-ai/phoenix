import { css } from "@emotion/react";

/** The space between neighboring segments, in pixels. */
const SEGMENT_GAP = 2;

/**
 * How close a marker has to be to a segment boundary, as a fraction of the
 * total, to be drawn in the gap between the two segments rather than inside
 * one of them.
 */
const BOUNDARY_EPSILON = 1e-9;

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
    /* Corners eased, not rounded off, so the bar reads as a bar and its
       ends as ends at any height */
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

/**
 * Each segment's share of the bar's fillable width, its value's share of the
 * total with slivers widened to the minimum. What the slivers gain is taken
 * from the segments above the minimum in proportion to their size, so the
 * shares still add up to what the values did.
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
 * Where along the bar a value falls once the segments are laid out: how far
 * across the fillable width, and how many gaps lie before that point. A value
 * on the boundary between two segments falls in the middle of the gap between
 * them, so a tick there points at the seam itself.
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
        gaps: index + (isLast ? 0 : 0.5),
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
  // Past every segment, on the track: the rest of the way at the raw scale
  const rest = totalValue > 0 ? (value - segmentStart) / totalValue : 0;
  return { fraction: fraction + rest, gaps: Math.max(values.length - 1, 0) };
}

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
  // A segment with nothing in it takes no room, and no gap either
  const visibleSegments = segments.filter((segment) => segment.value > 0);
  const hasSegments = visibleSegments.length > 0;
  // An all-zero breakdown has nothing to draw, and a bar of pure background
  // reads as a rendering failure rather than as an empty total. A track is
  // the exception: an empty track is how a zero share of a whole looks.
  if (!hasSegments && !showTrack) {
    return null;
  }
  const values = visibleSegments.map((segment) => segment.value);
  const fractions = getSegmentFractions({
    values,
    totalValue,
    minimumFraction: minimumSegmentPercentage / 100,
  });
  // The gaps are laid out in pixels and the segments share what is left, so
  // a segment's width is its share of the bar less the gaps
  const totalGap = SEGMENT_GAP * Math.max(visibleSegments.length - 1, 0);
  const fillableWidth = `(100% - ${totalGap}px)`;
  const markers = (markerValues ?? []).filter(
    (value) => value > 0 && value < totalValue
  );

  return (
    <div className="segment-chart" css={segmentChartCSS} data-track={showTrack}>
      <div className="segment-chart__bar" style={{ height: `${height}px` }}>
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
