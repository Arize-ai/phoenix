import { getLuminance } from "polished";

import type { SequentialColorInterpolator } from "../colors";

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
  const rowLabels = Array.from(
    new Set(actualLabels ?? data.map((datum) => datum.actual))
  );
  const columnLabels = Array.from(
    new Set(predictedLabels ?? data.map((datum) => datum.predicted))
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

  const rowTotals: number[] = new Array(rowLabels.length).fill(0);
  const columnTotals: number[] = new Array(columnLabels.length).fill(0);
  let total = 0;
  let maxCount = 0;
  for (let rowIndex = 0; rowIndex < counts.length; rowIndex++) {
    const row = counts[rowIndex];
    for (let columnIndex = 0; columnIndex < row.length; columnIndex++) {
      const value = row[columnIndex];
      rowTotals[rowIndex] += value;
      columnTotals[columnIndex] += value;
      total += value;
      if (value > maxCount) {
        maxCount = value;
      }
    }
  }

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

export type BinaryConfusionQuadrant = "TP" | "FN" | "FP" | "TN";

/**
 * Derives per-cell TP / FN / FP / TN tags for a binary matrix, keyed on the
 * positive label's identity rather than axis order — any 2×2 whose axes both
 * hold the positive class and the same negative class qualifies, in either
 * order. Returns null when the tags would be meaningless (multiclass,
 * mismatched label sets, or a positive label absent from an axis).
 */
export function getConfusionQuadrantLabels({
  actualLabels,
  predictedLabels,
  positiveLabel,
}: {
  actualLabels: string[];
  predictedLabels: string[];
  positiveLabel: string;
}): BinaryConfusionQuadrant[][] | null {
  const negativeLabel = actualLabels.find((label) => label !== positiveLabel);
  const isBinaryPair = (labels: string[]) =>
    labels.length === 2 &&
    negativeLabel != null &&
    labels.includes(positiveLabel) &&
    labels.includes(negativeLabel);
  if (!isBinaryPair(actualLabels) || !isBinaryPair(predictedLabels)) {
    return null;
  }
  return actualLabels.map((actual) =>
    predictedLabels.map((predicted): BinaryConfusionQuadrant => {
      if (actual === positiveLabel) {
        return predicted === positiveLabel ? "TP" : "FN";
      }
      return predicted === positiveLabel ? "FP" : "TN";
    })
  );
}

/**
 * Builds the count → density scale for one matrix: counts normalize into
 * t ∈ [0, 1] against `maxCount`. The denominator is fixed per matrix, so
 * derive the scale once and apply it per cell.
 */
export function createConfusionMatrixDensityScale({
  maxCount,
  scaleType,
}: {
  maxCount: number;
  scaleType: ConfusionMatrixScaleType;
}): (count: number) => number {
  if (maxCount <= 0) {
    return () => 0;
  }
  const denominator = scaleType === "log" ? Math.log1p(maxCount) : maxCount;
  return (count: number) => {
    if (count <= 0) {
      return 0;
    }
    const numerator = scaleType === "log" ? Math.log1p(count) : count;
    return Math.min(numerator / denominator, 1);
  };
}

/**
 * Above this relative luminance a cell is light enough that dark ink is both
 * higher-contrast and easier to read; below it, light ink wins. Chosen so the
 * mid-range of common d3 scales (blues, viridis, magma) keeps light ink.
 */
const DARK_INK_LUMINANCE_THRESHOLD = 0.4;

const DARK_INK = "var(--global-static-color-black-900)";
const LIGHT_INK = "var(--global-static-color-white-900)";

/**
 * Ink per fill color, cached because `getLuminance` re-parses the color
 * string on every call and a matrix asks about the same handful of fills
 * over and over. Bounded by the distinct colors an interpolator emits.
 */
const inkByFillColor = new Map<string, string>();

function getInkColor(backgroundColor: string): string {
  let ink = inkByFillColor.get(backgroundColor);
  if (ink == null) {
    try {
      ink =
        getLuminance(backgroundColor) > DARK_INK_LUMINANCE_THRESHOLD
          ? DARK_INK
          : LIGHT_INK;
    } catch {
      // The interpolator returned a color polished can't parse (a var()
      // expression, oklch(), color-mix(), …) — fall back to the theme's
      // default text color rather than crashing the render.
      ink = "var(--global-text-color-900)";
    }
    inkByFillColor.set(backgroundColor, ink);
  }
  return ink;
}

/**
 * Resolves the fill and a legible ink color for a cell at density t.
 */
export function getConfusionMatrixCellColors({
  colorInterpolator,
  density,
}: {
  colorInterpolator: SequentialColorInterpolator;
  density: number;
}): { backgroundColor: string; color: string } {
  const backgroundColor = colorInterpolator(density);
  return { backgroundColor, color: getInkColor(backgroundColor) };
}
