/**
 * A single observed (actual, predicted) pair with the number of times it
 * occurred. The confusion matrix is computed from a flat list of these so
 * callers can pass query results directly without pre-pivoting.
 */
export type ConfusionMatrixDatum = {
  /**
   * The ground-truth label
   */
  actual: string;
  /**
   * The label produced by the classifier / eval
   */
  predicted: string;
  /**
   * The number of times this (actual, predicted) pair occurred
   */
  count: number;
};

/**
 * A d3-scale-chromatic style interpolator: maps a normalized density
 * t ∈ [0, 1] to a CSS color (e.g. `interpolateViridis`, `interpolateBlues`).
 */
export type SequentialColorInterpolator = (t: number) => string;

/**
 * How cell counts are normalized into color density. Log keeps sparse cells
 * visible when one cell (typically the dominant true-negative) dwarfs the rest.
 */
export type ConfusionMatrixScaleType = "log" | "linear";

export type ComputedConfusionMatrix = {
  /**
   * Row labels (ground truth), in display order
   */
  actualLabels: string[];
  /**
   * Column labels (predictions), in display order
   */
  predictedLabels: string[];
  /**
   * counts[actualIndex][predictedIndex]
   */
  counts: number[][];
  /**
   * Total per actual label (row)
   */
  rowTotals: number[];
  /**
   * Total per predicted label (column)
   */
  columnTotals: number[];
  /**
   * Grand total across all cells
   */
  total: number;
  /**
   * The largest single cell count — the top of the color scale
   */
  maxCount: number;
};

/**
 * Quadrant names for a binary (2×2) matrix where the FIRST label on each axis
 * is the positive class: [row][column] over [positive, negative].
 */
export const BINARY_CONFUSION_QUADRANTS = [
  ["TP", "FN"],
  ["FP", "TN"],
] as const;

/**
 * Pivots a flat list of (actual, predicted, count) records into a dense
 * matrix with totals.
 *
 * Label sets are independent per axis, so the matrix may be non-square
 * (e.g. a judge that emits labels outside the ground-truth set). When
 * explicit labels are provided they define both membership and order, and
 * data outside them is ignored; otherwise labels are derived from the data
 * in first-seen order. Duplicate labels collapse to their first occurrence
 * and duplicate pairs accumulate.
 */
export function computeConfusionMatrix({
  data,
  actualLabels,
  predictedLabels,
}: {
  data: ConfusionMatrixDatum[];
  actualLabels?: string[];
  predictedLabels?: string[];
}): ComputedConfusionMatrix {
  const rowLabels = dedupeInOrder(
    actualLabels ?? data.map((datum) => datum.actual)
  );
  const columnLabels = dedupeInOrder(
    predictedLabels ?? data.map((datum) => datum.predicted)
  );
  const rowIndexByLabel = new Map(
    rowLabels.map((label, index) => [label, index])
  );
  const columnIndexByLabel = new Map(
    columnLabels.map((label, index) => [label, index])
  );

  const counts: number[][] = rowLabels.map(() =>
    new Array(columnLabels.length).fill(0)
  );
  for (const datum of data) {
    const rowIndex = rowIndexByLabel.get(datum.actual);
    const columnIndex = columnIndexByLabel.get(datum.predicted);
    if (rowIndex == null || columnIndex == null) {
      continue;
    }
    counts[rowIndex][columnIndex] += datum.count;
  }

  const rowTotals = counts.map((row) =>
    row.reduce((sum, value) => sum + value, 0)
  );
  const columnTotals = columnLabels.map((_, columnIndex) =>
    counts.reduce((sum, row) => sum + row[columnIndex], 0)
  );
  const total = rowTotals.reduce((sum, value) => sum + value, 0);
  const maxCount = counts.reduce((acc, row) => Math.max(acc, ...row), 0);

  return {
    actualLabels: rowLabels,
    predictedLabels: columnLabels,
    counts,
    rowTotals,
    columnTotals,
    total,
    maxCount,
  };
}

/**
 * Whether the two axes describe the same binary label set in the same
 * order — the precondition for TP/FN/FP/TN quadrant labeling.
 */
export function hasAlignedBinaryLabels(
  actualLabels: string[],
  predictedLabels: string[]
): boolean {
  return (
    actualLabels.length === 2 &&
    predictedLabels.length === 2 &&
    actualLabels[0] === predictedLabels[0] &&
    actualLabels[1] === predictedLabels[1]
  );
}

/**
 * Normalizes a cell count into t ∈ [0, 1] for the color scale.
 */
export function getConfusionMatrixDensity({
  count,
  maxCount,
  scaleType,
}: {
  count: number;
  maxCount: number;
  scaleType: ConfusionMatrixScaleType;
}): number {
  if (maxCount <= 0 || count <= 0) {
    return 0;
  }
  if (scaleType === "log") {
    return Math.min(Math.log1p(count) / Math.log1p(maxCount), 1);
  }
  return Math.min(count / maxCount, 1);
}

function dedupeInOrder(values: string[]): string[] {
  return Array.from(new Set(values));
}
