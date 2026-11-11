/**
 * The time-bin axis shared by the inline table charts (Sparkline and
 * StackedSparkline): how many source bins merge into one drawn bin at a
 * given width, and where each drawn bin sits. Charts built on the same axis
 * line up vertically across table rows.
 */

/** The source bins a drawn bin covers, as inclusive indexes into the series. */
export type SparklineBinRange = {
  start: number;
  end: number;
};

/** Horizontal coordinate space of the drawing box; the svg stretches to fit. */
export const SPARKLINE_DRAWING_WIDTH = 64;

/**
 * The horizontal room each drawn bin gets. Below this, adjacent bins merge:
 * marks narrower than a few pixels read as texture, not trend.
 */
const MIN_PIXELS_PER_BIN = 4;

/**
 * The width assumed until the container has been measured (and in
 * environments without layout), so the first paint already draws a
 * sensible number of bins.
 */
const FALLBACK_WIDTH = 160;

/**
 * The width to lay the axis out at: the measured width once there is one,
 * otherwise a fallback capped at `maxWidth`.
 */
export function getSparklineWidth({
  measuredWidth,
  maxWidth,
}: {
  measuredWidth: number | null | undefined;
  maxWidth: number | undefined;
}): number {
  return measuredWidth != null && measuredWidth > 0
    ? measuredWidth
    : Math.min(FALLBACK_WIDTH, maxWidth ?? FALLBACK_WIDTH);
}

/**
 * The drawn bins' source ranges: the `binCount` source bins merged in
 * equal-length runs so that each drawn bin keeps a few pixels at `width`.
 */
export function getSparklineBinRanges({
  binCount,
  width,
}: {
  binCount: number;
  width: number;
}): SparklineBinRange[] {
  const maxBins = Math.max(1, Math.floor(width / MIN_PIXELS_PER_BIN));
  const runLength = Math.max(1, Math.ceil(binCount / maxBins));
  const ranges: SparklineBinRange[] = [];
  for (let start = 0; start < binCount; start += runLength) {
    ranges.push({ start, end: Math.min(start + runLength, binCount) - 1 });
  }
  return ranges;
}

/**
 * The horizontal extent of a drawn bin on the axis, in drawing units: half a
 * source bin to either side of the bins it covers, clipped to the drawing
 * box. Bin centers sit at even steps from the left edge to the right.
 */
export function getSparklineBinExtent({
  range,
  binCount,
}: {
  range: SparklineBinRange;
  binCount: number;
}): { left: number; right: number } {
  if (binCount === 1) {
    return { left: 0, right: SPARKLINE_DRAWING_WIDTH };
  }
  const scale = SPARKLINE_DRAWING_WIDTH / (binCount - 1);
  return {
    left: Math.max(0, (range.start - 0.5) * scale),
    right: Math.min(SPARKLINE_DRAWING_WIDTH, (range.end + 0.5) * scale),
  };
}

/** The x of a drawn bin's center, in drawing units. */
export function getSparklineBinCenter({
  range,
  binCount,
}: {
  range: SparklineBinRange;
  binCount: number;
}): number {
  // A merged bin sits over the center of the source bins it covers
  const axisPosition = (range.start + range.end) / 2;
  return binCount === 1
    ? SPARKLINE_DRAWING_WIDTH / 2
    : (axisPosition / (binCount - 1)) * SPARKLINE_DRAWING_WIDTH;
}

/**
 * The drawing-space x of a pointer over an svg that stretches the drawing
 * box across its rendered width, or null before it has a width.
 */
export function getSparklineDrawingX({
  clientX,
  rect,
}: {
  clientX: number;
  rect: { left: number; width: number };
}): number | null {
  if (rect.width === 0) {
    return null;
  }
  return ((clientX - rect.left) / rect.width) * SPARKLINE_DRAWING_WIDTH;
}
