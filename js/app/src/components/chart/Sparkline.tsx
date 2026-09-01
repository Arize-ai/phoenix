import { css } from "@emotion/react";
import type { PointerEvent, ReactNode } from "react";
import { useId, useRef, useState } from "react";
import { TooltipTriggerStateContext } from "react-aria-components";
import { useTooltipTriggerState } from "react-stately";

import { RichTooltip } from "@phoenix/components";

const sparklineCSS = css`
  display: block;
  flex: 1 1 auto;
  min-width: 0;
  overflow: visible;
`;

export interface SparklineProps {
  /**
   * One value per time bin, in time order. Every bin occupies its own x
   * position whether or not it carries a value, so sparklines that share a
   * time axis align vertically when scanned across rows. Null marks a bin
   * with no value; the line breaks there rather than interpolating across
   * the gap, and an isolated value draws as a dot. A full-width baseline
   * track marks the axis, so sparse marks read as points in time on it.
   */
  values: ReadonlyArray<number | null>;
  /** Stroke color, e.g. a design token var. */
  color: string;
  /** Rendered height in pixels. The line stretches to fill the width. @default 20 */
  height?: number;
  /**
   * Detail for the point at a bin index, shown in a tooltip while hovering
   * near that point, which is also marked on the line. Only indexes of bins
   * that carry a value are passed. Omit for a non-interactive sparkline.
   */
  renderPointDetail?: (index: number) => ReactNode;
  /** Accessible description of what the line shows. */
  "aria-label"?: string;
}

/** Horizontal coordinate space of the drawing box; the svg stretches to fit. */
const DRAWING_WIDTH = 64;
/** Keeps the stroke from clipping at the extremes. */
const VERTICAL_PADDING = 2;
/**
 * The axis the marks sit on. Recessive like a chart grid line: it anchors
 * sparse marks to the shared time axis without competing with the series.
 */
const TRACK_COLOR = "var(--global-color-gray-300)";

type SparklinePoint = {
  x: number;
  y: number;
  /** The point's index within the values array. */
  index: number;
};

/**
 * The line as scaled points: values plotted top-to-bottom by magnitude and
 * left-to-right by bin position over the full bin axis — empty bins keep
 * their x slot rather than being squeezed out, so sparklines sharing a time
 * axis align vertically across rows. Null when no bin carries a value.
 */
function getPoints({
  values,
  height,
}: {
  values: ReadonlyArray<number | null>;
  height: number;
}): SparklinePoint[] | null {
  const present = values.flatMap((value, index) =>
    value == null ? [] : [{ value, index }]
  );
  if (present.length === 0) {
    return null;
  }
  const min = Math.min(...present.map((point) => point.value));
  const max = Math.max(...present.map((point) => point.value));
  const drawableHeight = height - 2 * VERTICAL_PADDING;
  return present.map(({ value, index }) => ({
    x:
      values.length === 1
        ? DRAWING_WIDTH / 2
        : (index / (values.length - 1)) * DRAWING_WIDTH,
    // A flat series draws as a midline rather than dividing by zero
    y:
      max === min
        ? height / 2
        : VERTICAL_PADDING + (1 - (value - min) / (max - min)) * drawableHeight,
    index,
  }));
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
      point.index !== segment[segment.length - 1].index + 1
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
 * A small inline line chart for table cells and stat tiles: a single series
 * over a recessive baseline track, stretching to fill the width its container
 * gives it. Bins keep their position on the axis and the line breaks at empty
 * bins, so gaps are visible, sparse values read as points in time on the
 * track, and sparklines sharing a time axis align across rows. With
 * `renderPointDetail`, hovering marks the nearest point and shows its detail
 * in a tooltip; further detail belongs to the surrounding component. Renders
 * nothing when no bin carries a value.
 */
export function Sparkline({
  values,
  color,
  height = 20,
  renderPointDetail,
  "aria-label": ariaLabel,
}: SparklineProps) {
  const titleId = useId();
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoveredPointIndex, setHoveredPointIndex] = useState<number | null>(
    null
  );
  // The tooltip is driven entirely by the pointer tracking below. Rendered
  // standalone (no TooltipTrigger), RAC's Tooltip still reads its state from
  // TooltipTriggerStateContext, so the state is created and provided here.
  const tooltipState = useTooltipTriggerState({
    isOpen: hoveredPointIndex != null,
    delay: 0,
  });
  const points = getPoints({ values, height });
  if (points == null) {
    return null;
  }
  const hoveredPoint =
    hoveredPointIndex == null
      ? null
      : (points.find((point) => point.index === hoveredPointIndex) ?? null);
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
          setHoveredPointIndex(nearest.index);
        };
  return (
    <>
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
          renderPointDetail == null
            ? undefined
            : () => setHoveredPointIndex(null)
        }
      >
        {ariaLabel != null ? <title id={titleId}>{ariaLabel}</title> : null}
        {/* The baseline track: the full time axis, drawn under the marks so
            sparse data reads as points on it rather than floating fragments */}
        <path
          d={`M 0 ${(height - 0.5).toFixed(2)} L ${DRAWING_WIDTH} ${(height - 0.5).toFixed(2)}`}
          fill="none"
          stroke={TRACK_COLOR}
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
        />
        {getSegments(points).map((segment) =>
          segment.length === 1 ? (
            // A gap-isolated value has no line to join; a zero-length
            // round-capped stroke renders as a dot that keeps its shape
            // under the svg's non-uniform stretching.
            <path
              key={segment[0].index}
              d={`M ${segment[0].x.toFixed(2)} ${segment[0].y.toFixed(2)} l 0.01 0`}
              fill="none"
              stroke={color}
              strokeWidth={3}
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          ) : (
            <path
              key={segment[0].index}
              d={segment
                .map(
                  (point, index) =>
                    `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`
                )
                .join(" ")}
              fill="none"
              stroke={color}
              strokeWidth={1.3}
              strokeLinecap="round"
              strokeLinejoin="round"
              // The svg stretches horizontally; keep the stroke width uniform
              vectorEffect="non-scaling-stroke"
            />
          )
        )}
        {hoveredPoint != null ? (
          // A zero-length round-capped stroke renders as a dot that, unlike a
          // circle, keeps its shape under the svg's non-uniform stretching.
          <path
            d={`M ${hoveredPoint.x.toFixed(2)} ${hoveredPoint.y.toFixed(2)} l 0.01 0`}
            fill="none"
            stroke={color}
            strokeWidth={5}
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
            style={{ pointerEvents: "none" }}
          />
        ) : null}
      </svg>
      {renderPointDetail != null && hoveredPointIndex != null ? (
        <TooltipTriggerStateContext.Provider value={tooltipState}>
          <RichTooltip triggerRef={svgRef} placement="top" offset={4}>
            {renderPointDetail(hoveredPointIndex)}
          </RichTooltip>
        </TooltipTriggerStateContext.Provider>
      ) : null}
    </>
  );
}
