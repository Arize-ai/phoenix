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
   * `weights`) so each step keeps a few pixels instead of collapsing into
   * noise. Each drawn point is a flat step across the bins it covers; steps
   * join vertically within a run and break at every empty point rather than
   * interpolating across it.
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
  /**
   * Whether to draw a coverage strip along the baseline: one cell per drawn
   * bin, filled where the bin carries a value and faint where it doesn't, so
   * presence reads separately from level. With the strip, the steps go
   * unshaded; without it, every run is shaded down to the baseline instead,
   * which is what keeps a sparse series reading as a chart.
   * @default false
   */
  showCoverage?: boolean;
  /** Rendered height in pixels. @default 20 */
  height?: number;
  /**
   * Widest the sparkline grows, in pixels. It otherwise stretches to the
   * width its flex container gives it. Defaults to unbounded.
   */
  maxWidth?: number;
  /**
   * Detail for a drawn point, shown in a tooltip while hovering near it,
   * which is also marked on the step. Receives the range of source bins the
   * point covers: a single bin unless bins were merged to fit the width. Only
   * ranges that carry a value are passed. Omit for a non-interactive sparkline.
   */
  renderPointDetail?: (range: SparklineBinRange) => ReactNode;
  /** Accessible description of what the sparkline shows. */
  "aria-label"?: string;
}

/** Horizontal coordinate space of the drawing box; the svg stretches to fit. */
const DRAWING_WIDTH = 64;
/** Keeps the stroke from clipping at the extremes. */
const VERTICAL_PADDING = 2;
/**
 * The horizontal room each drawn point gets. Below this, adjacent bins merge:
 * steps narrower than a few pixels read as texture, not trend.
 */
const MIN_PIXELS_PER_POINT = 4;
/**
 * The width assumed until the container has been measured (and in
 * environments without layout), so the first paint already draws a
 * sensible number of points.
 */
const FALLBACK_WIDTH = 160;
const LINE_WIDTH = 1.5;
/** The most recent value, anchoring where the series ends. */
const END_DOT_WIDTH = 3;
const HOVER_DOT_WIDTH = 5;
/**
 * The shading under the steps at their highest point; it fades to nothing at
 * the baseline. Faint enough to stay ink, not a bar: it anchors the steps to
 * the box so the eye reads a chart, and gives a lone step some mass.
 */
const FILL_TOP_OPACITY = 0.3;
/** The coverage strip's height, and the room between it and the steps. */
const COVERAGE_STRIP_HEIGHT = 3;
const COVERAGE_STRIP_GAP = 2;
/** The vertical room the coverage strip takes from the steps. */
const COVERAGE_STRIP_INSET = COVERAGE_STRIP_HEIGHT + COVERAGE_STRIP_GAP;
/** A coverage cell with data, and one without. */
const COVERAGE_PRESENT_OPACITY = 0.85;
const COVERAGE_EMPTY_OPACITY = 0.15;
/** The gap between adjacent coverage cells, in drawing units. */
const COVERAGE_CELL_INSET = 0.4;

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
 * Points split into one run per contiguous stretch of populated bins, so
 * the steps break at gaps instead of drawing through them: an empty bin is
 * absent data, never interpolated. A run of one is a lone step.
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

/**
 * A zero-length round-capped stroke renders as a dot that, unlike a circle,
 * keeps its shape under the svg's non-uniform horizontal stretching.
 */
function toDotPathData(point: SparklinePoint): string {
  return `M ${point.x.toFixed(2)} ${point.y.toFixed(2)} l 0.01 0`;
}

/**
 * The horizontal extent of a drawn bin on the axis: half a source bin to
 * either side of the bins it covers, clipped to the drawing box.
 */
function getBinExtent({
  range,
  binCount,
}: {
  range: SparklineBinRange;
  binCount: number;
}): { left: number; right: number } {
  if (binCount === 1) {
    return { left: 0, right: DRAWING_WIDTH };
  }
  const scale = DRAWING_WIDTH / (binCount - 1);
  return {
    left: Math.max(0, (range.start - 0.5) * scale),
    right: Math.min(DRAWING_WIDTH, (range.end + 0.5) * scale),
  };
}

/**
 * A run of points as steps: a flat segment across each point's bins, with a
 * vertical riser between neighbors. Open, for stroking.
 */
function toStepPathData({
  points,
  binCount,
}: {
  points: SparklinePoint[];
  binCount: number;
}): string {
  return points
    .map((point, index) => {
      const { left, right } = getBinExtent({
        range: point.bin.range,
        binCount,
      });
      const y = point.y.toFixed(2);
      return `${index === 0 ? "M" : "L"} ${left.toFixed(2)} ${y} L ${right.toFixed(2)} ${y}`;
    })
    .join(" ");
}

/** The region between a run of steps and the baseline at `height`. */
function toStepAreaPathData({
  points,
  binCount,
  height,
}: {
  points: SparklinePoint[];
  binCount: number;
  height: number;
}): string {
  const first = getBinExtent({ range: points[0].bin.range, binCount });
  const last = getBinExtent({
    range: points[points.length - 1].bin.range,
    binCount,
  });
  const baseline = height.toFixed(2);
  return `${toStepPathData({ points, binCount })} L ${last.right.toFixed(2)} ${baseline} L ${first.left.toFixed(2)} ${baseline} Z`;
}

/** The shaded regions under each run, drawn first so strokes sit on top. */
function Shading({
  segments,
  binCount,
  height,
  fill,
}: {
  segments: SparklinePoint[][];
  binCount: number;
  height: number;
  fill: string;
}) {
  return segments.map((segment) => (
    <path
      key={segment[0].bin.position}
      d={toStepAreaPathData({ points: segment, binCount, height })}
      fill={fill}
      stroke="none"
    />
  ));
}

/**
 * One cell per drawn bin along the baseline: filled where the bin carries a
 * value, faint where it doesn't, so presence reads separately from level.
 */
function CoverageStrip({
  bins,
  binCount,
  height,
  color,
}: {
  bins: SparklineBin[];
  binCount: number;
  height: number;
  color: string;
}) {
  return bins.map((bin) => {
    const { left, right } = getBinExtent({ range: bin.range, binCount });
    return (
      <rect
        key={bin.position}
        x={(left + COVERAGE_CELL_INSET).toFixed(2)}
        y={height - COVERAGE_STRIP_HEIGHT}
        width={Math.max(0, right - left - 2 * COVERAGE_CELL_INSET).toFixed(2)}
        height={COVERAGE_STRIP_HEIGHT}
        fill={color}
        fillOpacity={
          bin.value == null ? COVERAGE_EMPTY_OPACITY : COVERAGE_PRESENT_OPACITY
        }
      />
    );
  });
}

/**
 * A small inline step chart for table cells and stat tiles: a single series
 * stretching to fill the width its container gives it, up to `maxWidth`.
 * Every drawn point is a flat step across the bins it covers, so a per-bin
 * aggregate reads as the whole bin's level and a lone value is a short
 * shelf rather than a dot. Bins keep their position on the axis, so
 * sparklines sharing a time axis align across rows, and a series ending
 * early visibly stops short. When the width can't give every bin a few
 * pixels, adjacent bins merge into weighted means so the steps stay legible
 * at any size. The steps break at every empty point, never interpolating
 * across missing data, and the most recent value is marked. Presence is
 * carried either by shading each run down to the baseline or, with
 * `showCoverage`, by a strip of per-bin cells along the baseline. With
 * `renderPointDetail`, hovering marks the nearest point and shows its detail
 * in a tooltip; further detail belongs to the surrounding component. Renders
 * nothing when no bin carries a value.
 */
export function Sparkline({
  values,
  weights,
  minRange,
  color,
  showCoverage = false,
  height = 20,
  maxWidth,
  renderPointDetail,
  "aria-label": ariaLabel,
}: SparklineProps) {
  const titleId = useId();
  const gradientId = useId();
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
  // The coverage strip takes its room from the bottom of the box; the steps
  // plot into what remains
  const plotHeight = height - (showCoverage ? COVERAGE_STRIP_INSET : 0);
  const points = getPoints({
    bins,
    binCount: values.length,
    height: plotHeight,
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
  // The shading is a single vertical gradient in drawing coordinates, from
  // the series' highest step to the baseline, shared by every run: equal
  // heights shade equally across the whole chart, and a flat run (whose own
  // bounding box has no height) still shades.
  const top = Math.min(...points.map((point) => point.y));
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
        {/* Presence goes down first so every stroke sits on top of it: the
            coverage strip when asked for, otherwise shading under each run */}
        {showCoverage ? (
          <CoverageStrip
            bins={bins}
            binCount={values.length}
            height={height}
            color={color}
          />
        ) : (
          <>
            <defs>
              <linearGradient
                id={gradientId}
                gradientUnits="userSpaceOnUse"
                x1="0"
                y1={top.toFixed(2)}
                x2="0"
                y2={plotHeight}
              >
                <stop
                  offset="0"
                  stopColor={color}
                  stopOpacity={FILL_TOP_OPACITY}
                />
                <stop offset="1" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <Shading
              segments={segments}
              binCount={values.length}
              height={plotHeight}
              fill={`url(#${gradientId})`}
            />
          </>
        )}
        {segments.map((segment) => (
          // Every step, even a lone one, spans its bin, so there is no dot
          // case: a single flat segment already has the line's weight
          <path
            key={segment[0].bin.position}
            d={toStepPathData({ points: segment, binCount: values.length })}
            fill="none"
            stroke={color}
            strokeWidth={LINE_WIDTH}
            strokeLinecap="round"
            strokeLinejoin="round"
            // The svg stretches horizontally; keep the stroke width uniform
            vectorEffect="non-scaling-stroke"
          />
        ))}
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
