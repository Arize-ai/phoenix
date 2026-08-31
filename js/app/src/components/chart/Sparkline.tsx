import { css } from "@emotion/react";
import { useId } from "react";

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
  /** Accessible description of what the line shows. */
  "aria-label"?: string;
}

/** Horizontal coordinate space of the drawing box; the svg stretches to fit. */
const DRAWING_WIDTH = 64;
/** Keeps the stroke from clipping at the extremes. */
const VERTICAL_PADDING = 2;

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
}): { x: number; y: number }[] | null {
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
  }));
}

/**
 * A small inline line chart for table cells and stat tiles: a single series,
 * no axes and no interaction, stretching to fill the width its container
 * gives it. Detail belongs in the surrounding component's tooltip. Renders
 * nothing when fewer than two bins carry values — a single point has no
 * trend to show.
 */
export function Sparkline({
  values,
  color,
  height = 20,
  "aria-label": ariaLabel,
}: SparklineProps) {
  const titleId = useId();
  const points = getPoints({ values, height });
  if (points == null) {
    return null;
  }
  return (
    <svg
      css={sparklineCSS}
      style={{ height }}
      viewBox={`0 0 ${DRAWING_WIDTH} ${height}`}
      preserveAspectRatio="none"
      role="img"
      aria-hidden={ariaLabel == null || undefined}
      aria-labelledby={ariaLabel != null ? titleId : undefined}
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
    </svg>
  );
}
