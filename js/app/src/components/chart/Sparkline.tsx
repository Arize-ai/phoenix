import { css } from "@emotion/react";
import { useId } from "react";

const sparklineCSS = css`
  display: block;
  flex: none;
  overflow: visible;
`;

export interface SparklineProps {
  /**
   * One value per time bin, in time order. Null marks a bin with no value;
   * the line breaks there rather than interpolating across the gap.
   */
  values: ReadonlyArray<number | null>;
  /** Stroke color, e.g. a design token var. */
  color: string;
  /** @default 64 */
  width?: number;
  /** @default 20 */
  height?: number;
  /** Accessible description of what the line shows. */
  "aria-label"?: string;
}

/** Keeps the stroke from clipping at the extremes. */
const VERTICAL_PADDING = 2;

/**
 * The line segments of the sparkline: values scaled into the drawing box,
 * split into one polyline per contiguous run of non-null values.
 */
function getSegments({
  values,
  width,
  height,
}: {
  values: ReadonlyArray<number | null>;
  width: number;
  height: number;
}): { x: number; y: number }[][] {
  const present = values.filter((value): value is number => value != null);
  if (present.length === 0) {
    return [];
  }
  const min = Math.min(...present);
  const max = Math.max(...present);
  const drawableHeight = height - 2 * VERTICAL_PADDING;
  const toY = (value: number) =>
    // A flat series draws as a midline rather than dividing by zero
    max === min
      ? height / 2
      : VERTICAL_PADDING + (1 - (value - min) / (max - min)) * drawableHeight;
  const toX = (index: number) =>
    values.length === 1 ? width / 2 : (index / (values.length - 1)) * width;
  const segments: { x: number; y: number }[][] = [];
  let segment: { x: number; y: number }[] = [];
  values.forEach((value, index) => {
    if (value == null) {
      if (segment.length > 0) {
        segments.push(segment);
        segment = [];
      }
      return;
    }
    segment.push({ x: toX(index), y: toY(value) });
  });
  if (segment.length > 0) {
    segments.push(segment);
  }
  return segments;
}

/**
 * A small inline line chart for table cells and stat tiles: a single series,
 * no axes and no interaction. Detail belongs in the surrounding component's
 * tooltip. Renders nothing when every value is null.
 */
export function Sparkline({
  values,
  color,
  width = 64,
  height = 20,
  "aria-label": ariaLabel,
}: SparklineProps) {
  const titleId = useId();
  const segments = getSegments({ values, width, height });
  if (segments.length === 0) {
    return null;
  }
  return (
    <svg
      css={sparklineCSS}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-hidden={ariaLabel == null || undefined}
      aria-labelledby={ariaLabel != null ? titleId : undefined}
    >
      {ariaLabel != null ? <title id={titleId}>{ariaLabel}</title> : null}
      {segments.map((segment, index) =>
        // An isolated point has no line to draw, so mark it with a dot
        segment.length === 1 ? (
          <circle
            key={index}
            cx={segment[0].x}
            cy={segment[0].y}
            r={1.5}
            fill={color}
          />
        ) : (
          <path
            key={index}
            d={segment
              .map(
                (point, pointIndex) =>
                  `${pointIndex === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`
              )
              .join(" ")}
            fill="none"
            stroke={color}
            strokeWidth={1.3}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )
      )}
    </svg>
  );
}
