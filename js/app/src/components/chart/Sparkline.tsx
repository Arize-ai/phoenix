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
   * One value per time bin, in time order. Null marks a bin with no value;
   * the line connects straight through such gaps.
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

type SparklinePoint = {
  x: number;
  y: number;
  /** The point's index within the values array. */
  index: number;
};

/**
 * The line as scaled points: values plotted top-to-bottom by magnitude and
 * left-to-right by bin position, with the first and last populated bins
 * pinned to the edges so the line always spans the full width. Null when
 * fewer than two bins carry values — a single point has no trend to draw.
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
  if (present.length < 2) {
    return null;
  }
  const min = Math.min(...present.map((point) => point.value));
  const max = Math.max(...present.map((point) => point.value));
  const drawableHeight = height - 2 * VERTICAL_PADDING;
  const firstIndex = present[0].index;
  const lastIndex = present[present.length - 1].index;
  return present.map(({ value, index }) => ({
    x: ((index - firstIndex) / (lastIndex - firstIndex)) * DRAWING_WIDTH,
    // A flat series draws as a midline rather than dividing by zero
    y:
      max === min
        ? height / 2
        : VERTICAL_PADDING + (1 - (value - min) / (max - min)) * drawableHeight,
    index,
  }));
}

/**
 * A small inline line chart for table cells and stat tiles: a single series,
 * no axes, stretching to fill the width its container gives it. With
 * `renderPointDetail`, hovering marks the nearest point and shows its detail
 * in a tooltip; further detail belongs to the surrounding component. Renders
 * nothing when fewer than two bins carry values — a single point has no
 * trend to show.
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
        <path
          d={points
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
