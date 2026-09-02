import { css } from "@emotion/react";
import type { PointerEvent, ReactNode } from "react";
import { useId, useRef, useState } from "react";
import { TooltipTriggerStateContext } from "react-aria-components";
import { useTooltipTriggerState } from "react-stately";

import { RichTooltip } from "@phoenix/components";
import { useDimensions } from "@phoenix/hooks/useDimensions";

const containerCSS = css`
  display: block;
  flex: 1 1 auto;
  min-width: 0;
`;

const sparklineCSS = css`
  display: block;
  width: 100%;
  overflow: visible;
`;

/** The source bins a drawn point covers, as inclusive indexes into `values`. */
export type SparklineBinRange = {
  start: number;
  end: number;
};

export interface SparklineProps {
  /**
   * One value per time bin, in time order. Every bin occupies its own x
   * position whether or not it carries a value, so sparklines that share a
   * time axis align vertically when scanned across rows. Null marks a bin
   * with no value.
   *
   * When there are more bins than the rendered width can resolve, runs of
   * adjacent bins are merged into one drawn point (a weighted mean, see
   * `weights`) so the line keeps a few pixels per point instead of collapsing
   * into noise. The line breaks at empty drawn points, bridging a gap of a
   * single point faintly; an isolated value draws as a dot.
   */
  values: ReadonlyArray<number | null>;
  /**
   * Per-bin weights for merging adjacent bins, e.g. the number of samples
   * behind each bin's mean. Defaults to equal weights.
   */
  weights?: ReadonlyArray<number>;
  /**
   * The smallest value range the vertical axis spans. Keeps a series that
   * barely moves from being stretched to look volatile: the axis covers at
   * least this much, centered on the data, and grows to fit wider data.
   * Defaults to the data's own range.
   */
  minRange?: number;
  /** Stroke color, e.g. a design token var. */
  color: string;
  /** Rendered height in pixels. @default 20 */
  height?: number;
  /**
   * Widest the sparkline grows, in pixels. It otherwise stretches to the
   * width its flex container gives it. Defaults to unbounded.
   */
  maxWidth?: number;
  /**
   * Detail for a drawn point, shown in a tooltip while hovering near it,
   * which is also marked on the line. Receives the range of source bins the
   * point covers: a single bin unless bins were merged to fit the width. Only
   * ranges that carry a value are passed. Omit for a non-interactive sparkline.
   */
  renderPointDetail?: (range: SparklineBinRange) => ReactNode;
  /** Accessible description of what the line shows. */
  "aria-label"?: string;
}

/** Horizontal coordinate space of the drawing box; the svg stretches to fit. */
const DRAWING_WIDTH = 64;
/** Keeps the stroke from clipping at the extremes. */
const VERTICAL_PADDING = 2;
/**
 * The horizontal room each drawn point gets. Below this, adjacent bins merge:
 * a line with less than a few pixels per point reads as texture, not trend.
 */
const MIN_PIXELS_PER_POINT = 4;
/**
 * The width assumed until the container has been measured (and in
 * environments without layout), so the first paint already draws a
 * sensible number of points.
 */
const FALLBACK_WIDTH = 160;
const LINE_WIDTH = 1.5;
/** An isolated value: the same visual weight as the line, not a marker. */
const ISOLATED_DOT_WIDTH = 2.5;
/** The most recent value, anchoring where the series ends. */
const END_DOT_WIDTH = 3;
const HOVER_DOT_WIDTH = 5;
/** A bridge across a single empty point: present, but visibly interpolated. */
const BRIDGE_OPACITY = 0.4;
/** The widest gap (in drawn points) the line bridges instead of breaking at. */
const MAX_BRIDGED_GAP = 1;

/** A drawn point: one source bin, or several merged to fit the width. */
type SparklineBin = {
  /** The bin's position in the drawn sequence. */
  position: number;
  /** The source bins it covers, inclusive. */
  range: SparklineBinRange;
  value: number | null;
};

type SparklinePoint = {
  x: number;
  y: number;
  bin: SparklineBin;
};

/**
 * The drawn sequence: the source bins, merged in equal-length runs so that no
 * more than `maxPoints` remain. A merged bin's value is the weighted mean of
 * the values it covers, or null when it covers none.
 */
function getBins({
  values,
  weights,
  maxPoints,
}: {
  values: ReadonlyArray<number | null>;
  weights: ReadonlyArray<number> | undefined;
  maxPoints: number;
}): SparklineBin[] {
  const runLength = Math.max(1, Math.ceil(values.length / maxPoints));
  const bins: SparklineBin[] = [];
  for (let start = 0; start < values.length; start += runLength) {
    const end = Math.min(start + runLength, values.length) - 1;
    let weightedSum = 0;
    let totalWeight = 0;
    for (let index = start; index <= end; index++) {
      const value = values[index];
      if (value == null) {
        continue;
      }
      const weight = weights?.[index] ?? 1;
      weightedSum += value * weight;
      totalWeight += weight;
    }
    bins.push({
      position: bins.length,
      range: { start, end },
      value: totalWeight > 0 ? weightedSum / totalWeight : null,
    });
  }
  return bins;
}

/**
 * The bins that carry a value as scaled points: plotted top-to-bottom by
 * magnitude and left-to-right by position over the full bin axis — empty
 * bins keep their x slot rather than being squeezed out, so sparklines
 * sharing a time axis align vertically across rows. Null when no bin
 * carries a value.
 */
function getPoints({
  bins,
  binCount,
  height,
  minRange,
}: {
  bins: SparklineBin[];
  /** The number of source bins, which is the length of the x axis. */
  binCount: number;
  height: number;
  minRange: number | undefined;
}): SparklinePoint[] | null {
  const present = bins.flatMap((bin) =>
    bin.value == null ? [] : [{ bin, value: bin.value }]
  );
  if (present.length === 0) {
    return null;
  }
  const dataMin = Math.min(...present.map((point) => point.value));
  const dataMax = Math.max(...present.map((point) => point.value));
  // Widen a narrow data range to the floor, keeping the data centered
  const padding = Math.max(0, (minRange ?? 0) - (dataMax - dataMin)) / 2;
  const min = dataMin - padding;
  const max = dataMax + padding;
  const drawableHeight = height - 2 * VERTICAL_PADDING;
  return present.map(({ bin, value }) => {
    const { start, end } = bin.range;
    // A merged bin sits over the center of the source bins it covers
    const axisPosition = (start + end) / 2;
    return {
      x:
        binCount === 1
          ? DRAWING_WIDTH / 2
          : (axisPosition / (binCount - 1)) * DRAWING_WIDTH,
      // A flat series draws as a midline rather than dividing by zero
      y:
        max === min
          ? height / 2
          : VERTICAL_PADDING +
            (1 - (value - min) / (max - min)) * drawableHeight,
      bin,
    };
  });
}

/**
 * Points split into one polyline per contiguous run of populated bins, so
 * the line breaks at gaps instead of drawing through them. A run of one is
 * a gap-isolated point, rendered as a dot.
 */
function getSegments(points: SparklinePoint[]): SparklinePoint[][] {
  const segments: SparklinePoint[][] = [];
  let segment: SparklinePoint[] = [];
  for (const point of points) {
    if (
      segment.length > 0 &&
      point.bin.position !== segment[segment.length - 1].bin.position + 1
    ) {
      segments.push(segment);
      segment = [];
    }
    segment.push(point);
  }
  segments.push(segment);
  return segments;
}

function toPathData(points: SparklinePoint[]): string {
  return points
    .map(
      (point, index) =>
        `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`
    )
    .join(" ");
}

/**
 * A zero-length round-capped stroke renders as a dot that, unlike a circle,
 * keeps its shape under the svg's non-uniform horizontal stretching.
 */
function toDotPathData(point: SparklinePoint): string {
  return `M ${point.x.toFixed(2)} ${point.y.toFixed(2)} l 0.01 0`;
}

/**
 * A small inline line chart for table cells and stat tiles: a single series
 * stretching to fill the width its container gives it, up to `maxWidth`.
 * Bins keep their position on the axis, so sparklines sharing a time axis
 * align across rows, and a series ending early visibly stops short. When the
 * width can't give every bin a few pixels, adjacent bins merge into weighted
 * means so the line stays legible at any size. The line breaks at empty
 * points, bridging single-point gaps faintly, and marks its most recent
 * value. With `renderPointDetail`, hovering marks the nearest point and
 * shows its detail in a tooltip; further detail belongs to the surrounding
 * component. Renders nothing when no bin carries a value.
 */
export function Sparkline({
  values,
  weights,
  minRange,
  color,
  height = 20,
  maxWidth,
  renderPointDetail,
  "aria-label": ariaLabel,
}: SparklineProps) {
  const titleId = useId();
  const containerRef = useRef<HTMLSpanElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const dimensions = useDimensions(containerRef);
  const [hoveredPosition, setHoveredPosition] = useState<number | null>(null);
  // The tooltip is driven entirely by the pointer tracking below. Rendered
  // standalone (no TooltipTrigger), RAC's Tooltip still reads its state from
  // TooltipTriggerStateContext, so the state is created and provided here.
  const tooltipState = useTooltipTriggerState({
    isOpen: hoveredPosition != null,
    delay: 0,
  });
  const width =
    dimensions != null && dimensions.width > 0
      ? dimensions.width
      : Math.min(FALLBACK_WIDTH, maxWidth ?? FALLBACK_WIDTH);
  const bins = getBins({
    values,
    weights,
    maxPoints: Math.max(1, Math.floor(width / MIN_PIXELS_PER_POINT)),
  });
  const points = getPoints({
    bins,
    binCount: values.length,
    height,
    minRange,
  });
  if (points == null) {
    return null;
  }
  const lastPoint = points[points.length - 1];
  const hoveredPoint =
    hoveredPosition == null
      ? null
      : (points.find((point) => point.bin.position === hoveredPosition) ??
        null);
  const onPointerMove =
    renderPointDetail == null
      ? undefined
      : (event: PointerEvent<SVGSVGElement>) => {
          const rect = event.currentTarget.getBoundingClientRect();
          if (rect.width === 0) {
            return;
          }
          // The svg stretches horizontally, so hit testing maps the pointer
          // back into drawing space and snaps to the nearest point by x.
          const drawingX =
            ((event.clientX - rect.left) / rect.width) * DRAWING_WIDTH;
          const nearest = points.reduce((closest, point) =>
            Math.abs(point.x - drawingX) < Math.abs(closest.x - drawingX)
              ? point
              : closest
          );
          setHoveredPosition(nearest.bin.position);
        };
  const segments = getSegments(points);
  return (
    <span ref={containerRef} css={containerCSS} style={{ height, maxWidth }}>
      <svg
        ref={svgRef}
        css={sparklineCSS}
        style={{ height }}
        viewBox={`0 0 ${DRAWING_WIDTH} ${height}`}
        preserveAspectRatio="none"
        role="img"
        aria-hidden={ariaLabel == null || undefined}
        aria-labelledby={ariaLabel != null ? titleId : undefined}
        onPointerMove={onPointerMove}
        onPointerLeave={
          renderPointDetail == null ? undefined : () => setHoveredPosition(null)
        }
      >
        {ariaLabel != null ? <title id={titleId}>{ariaLabel}</title> : null}
        {segments.map((segment, segmentIndex) => {
          const previous = segments[segmentIndex - 1];
          const first = segment[0];
          const gap =
            previous == null
              ? null
              : first.bin.position -
                previous[previous.length - 1].bin.position -
                1;
          return (
            <g key={first.bin.position}>
              {gap != null && gap <= MAX_BRIDGED_GAP ? (
                // A short gap: span it faintly so the trend reads through
                // a momentary lapse instead of shattering into fragments
                <path
                  d={toPathData([previous[previous.length - 1], first])}
                  fill="none"
                  stroke={color}
                  strokeOpacity={BRIDGE_OPACITY}
                  strokeWidth={LINE_WIDTH}
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                />
              ) : null}
              {segment.length === 1 ? (
                // A gap-isolated value has no line to join, so it draws
                // as a dot of the line's weight
                <path
                  d={toDotPathData(first)}
                  fill="none"
                  stroke={color}
                  strokeWidth={ISOLATED_DOT_WIDTH}
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                />
              ) : (
                <path
                  d={toPathData(segment)}
                  fill="none"
                  stroke={color}
                  strokeWidth={LINE_WIDTH}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  // The svg stretches horizontally; keep the stroke width uniform
                  vectorEffect="non-scaling-stroke"
                />
              )}
            </g>
          );
        })}
        {/* The most recent value: where the series stands now, and where
            it stops if the axis runs on past it */}
        <path
          d={toDotPathData(lastPoint)}
          fill="none"
          stroke={color}
          strokeWidth={END_DOT_WIDTH}
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        {hoveredPoint != null ? (
          <path
            d={toDotPathData(hoveredPoint)}
            fill="none"
            stroke={color}
            strokeWidth={HOVER_DOT_WIDTH}
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
            style={{ pointerEvents: "none" }}
          />
        ) : null}
      </svg>
      {renderPointDetail != null && hoveredPoint != null ? (
        <TooltipTriggerStateContext.Provider value={tooltipState}>
          <RichTooltip triggerRef={svgRef} placement="top" offset={4}>
            {renderPointDetail(hoveredPoint.bin.range)}
          </RichTooltip>
        </TooltipTriggerStateContext.Provider>
      ) : null}
    </span>
  );
}
