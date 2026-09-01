import { css } from "@emotion/react";
import { Fragment } from "react";

import type { ComponentSize } from "@phoenix/components/core/types";
import { classNames } from "@phoenix/utils/classNames";
import { formatInt, formatPercent } from "@phoenix/utils/numberFormatUtils";

import {
  getConfusionMatrixCellColors,
  useDefaultConfusionMatrixColorInterpolator,
} from "./confusionMatrixColors";
import { ConfusionMatrixLegend } from "./ConfusionMatrixLegend";
import type {
  ConfusionMatrixDatum,
  ConfusionMatrixScaleType,
  SequentialColorInterpolator,
} from "./confusionMatrixUtils";
import {
  BINARY_CONFUSION_QUADRANTS,
  computeConfusionMatrix,
  getConfusionMatrixDensity,
  hasAlignedBinaryLabels,
} from "./confusionMatrixUtils";

const confusionMatrixCSS = css`
  display: flex;
  flex-direction: column;
  gap: var(--global-dimension-size-100);
  width: 100%;

  .confusion-matrix__body {
    display: flex;
    flex-direction: row;
    align-items: stretch;
    gap: var(--global-dimension-size-50);
  }

  .confusion-matrix__y-axis-label {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: center;
    writing-mode: vertical-rl;
    transform: rotate(180deg);
    font-size: var(--global-font-size-xs);
    color: var(--global-text-color-500);
    /* Skip the axis-title and header rows so the label centers on the cells */
    padding-bottom: var(--global-dimension-size-500);
  }

  .confusion-matrix__y-axis-label--with-totals {
    /* Also skip the totals row (min-height + grid gap) at the bottom */
    padding-top: calc(
      var(--global-dimension-size-450) + var(--global-dimension-size-75)
    );
  }

  .confusion-matrix__grid {
    flex: 1 1 0;
    min-width: 0;
    display: grid;
    gap: var(--global-dimension-size-75);
    align-items: stretch;
  }

  .confusion-matrix__x-axis-label {
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: var(--global-font-size-xs);
    color: var(--global-text-color-500);
  }

  .confusion-matrix__column-header,
  .confusion-matrix__row-header {
    font-size: var(--global-font-size-s);
    color: var(--global-text-color-700);
    min-width: 0;
    overflow: hidden;
  }

  .confusion-matrix__column-header {
    display: flex;
    align-items: center;
    justify-content: center;
    text-align: center;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .confusion-matrix__column-header--total,
  .confusion-matrix__row-header--total {
    color: var(--global-text-color-500);
    font-size: var(--global-font-size-xs);
  }

  .confusion-matrix__row-header {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    text-align: right;
    padding-inline-end: var(--global-dimension-size-100);
    max-width: var(--global-dimension-size-2000);
  }

  .confusion-matrix__cell,
  .confusion-matrix__total {
    position: relative;
    border-radius: var(--global-rounding-medium);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--global-dimension-size-25);
    padding: var(--global-dimension-size-100);
    min-width: 0;
    overflow: hidden;
  }

  .confusion-matrix__cell--empty {
    background-color: var(--global-color-gray-100);
    color: var(--global-text-color-300);
  }

  .confusion-matrix__total {
    background-color: var(--global-color-gray-100);
    color: var(--global-text-color-900);
  }

  .confusion-matrix__total--grand {
    background-color: transparent;
    border: var(--global-border-size-thin) solid
      rgba(var(--global-color-gray-500-rgb), 0.5);
  }

  .confusion-matrix__count {
    font-family: var(--global-font-family-mono);
    font-weight: var(--global-font-weight-semibold);
  }

  .confusion-matrix__percentage {
    font-size: var(--global-font-size-xs);
    opacity: 0.75;
  }

  .confusion-matrix__total .confusion-matrix__percentage {
    color: var(--global-text-color-500);
    opacity: 1;
  }

  .confusion-matrix__quadrant {
    position: absolute;
    top: var(--global-dimension-size-100);
    right: var(--global-dimension-size-125);
    font-family: var(--global-font-family-mono);
    font-size: var(--global-font-size-xxs);
    letter-spacing: 0.08em;
    opacity: 0.6;
  }

  &[data-size="S"] {
    .confusion-matrix__cell {
      min-height: var(--global-dimension-size-450);
    }
    .confusion-matrix__count {
      font-size: var(--global-font-size-xs);
    }
    .confusion-matrix__column-header,
    .confusion-matrix__row-header {
      font-size: var(--global-font-size-xs);
    }
  }

  &[data-size="M"] {
    .confusion-matrix__cell {
      min-height: var(--global-dimension-size-800);
    }
    .confusion-matrix__count {
      font-size: var(--global-font-size-s);
    }
  }

  &[data-size="L"] {
    .confusion-matrix__cell {
      min-height: var(--global-dimension-size-1600);
    }
    .confusion-matrix__count {
      font-size: var(--global-font-size-xl);
      line-height: var(--global-line-height-xl);
    }
  }

  /* Totals stay compact regardless of cell size */
  .confusion-matrix__total {
    min-height: var(--global-dimension-size-450);
  }
`;

export type ConfusionMatrixProps = {
  /**
   * Flat (actual, predicted, count) records; the matrix is pivoted from these
   */
  data: ConfusionMatrixDatum[];
  /**
   * Explicit row (ground truth) labels and order. Derived from the data in
   * first-seen order when omitted. For binary matrices put the positive
   * class first so quadrant labels read correctly.
   */
  actualLabels?: string[];
  /**
   * Explicit column (prediction) labels and order. The two axes are
   * independent, so the matrix may be non-square.
   */
  predictedLabels?: string[];
  /**
   * A d3-scale-chromatic style interpolator (t ∈ [0,1] → color) for cell
   * density, applied as-is: the densest cell gets `colorInterpolator(1)`, so
   * pick a scale whose 1-end is its most colorful (wrap with
   * `reverseColorInterpolator` to flip one, or build a custom ramp with
   * `createSequentialColorInterpolator`). Defaults to the theme-aware
   * Phoenix sequential blues, which gain color with density.
   */
  colorInterpolator?: SequentialColorInterpolator;
  /**
   * How counts map to color density
   * @default 'log'
   */
  scaleType?: ConfusionMatrixScaleType;
  /**
   * The physical density of the cells
   * @default 'M'
   */
  size?: ComponentSize;
  /**
   * The count that maps to the top of the color scale. Defaults to the
   * largest cell in the data. Pin it when several matrices share a
   * `ConfusionMatrixLegend` so their colors are directly comparable.
   */
  maxCount?: number;
  /**
   * Show marginal totals (per row, per column, and grand total)
   * @default true
   */
  showTotals?: boolean;
  /**
   * Show each cell's share of the grand total under its count
   * @default false
   */
  showPercentage?: boolean;
  /**
   * Tag the four quadrants TP / FN / FP / TN. Only applies when both axes
   * list the same two labels in the same order, with the positive class
   * first — pass explicit `actualLabels`/`predictedLabels` to guarantee
   * that; labels derived from the data follow first-seen order.
   * @default false
   */
  showQuadrantLabels?: boolean;
  /**
   * Show the fewer → more gradient legend beneath the matrix. Turn off when
   * multiple matrices on a page share a standalone `ConfusionMatrixLegend`.
   * @default true
   */
  showLegend?: boolean;
  /**
   * What the density encodes, shown next to the legend gradient
   * @default 'count · <scaleType> scale'
   */
  legendLabel?: string;
  /**
   * The title for the row axis
   * @default 'actual'
   */
  actualAxisLabel?: string;
  /**
   * The title for the column axis
   * @default 'predicted'
   */
  predictedAxisLabel?: string;
};

/**
 * A cell's count with its optional share of the grand total.
 */
function CellValue({
  count,
  total,
  showPercentage,
}: {
  count: number;
  total: number;
  showPercentage: boolean;
}) {
  return (
    <>
      <span className="confusion-matrix__count">{formatInt(count)}</span>
      {showPercentage && total > 0 && (
        <span className="confusion-matrix__percentage">
          {formatPercent((count / total) * 100)}
        </span>
      )}
    </>
  );
}

/**
 * One density-colored cell: fill and ink from the scale, muted when empty.
 */
function MatrixCell({
  count,
  total,
  maxCount,
  scaleType,
  colorInterpolator,
  showPercentage,
  quadrantLabel,
}: {
  count: number;
  total: number;
  maxCount: number;
  scaleType: ConfusionMatrixScaleType;
  colorInterpolator: SequentialColorInterpolator;
  showPercentage: boolean;
  quadrantLabel?: string;
}) {
  const isEmpty = count === 0;
  const cellColors = isEmpty
    ? undefined
    : getConfusionMatrixCellColors({
        colorInterpolator,
        density: getConfusionMatrixDensity({ count, maxCount, scaleType }),
      });
  return (
    <div
      className={classNames("confusion-matrix__cell", {
        "confusion-matrix__cell--empty": isEmpty,
      })}
      style={cellColors}
    >
      {quadrantLabel && (
        <span className="confusion-matrix__quadrant">{quadrantLabel}</span>
      )}
      <CellValue count={count} total={total} showPercentage={showPercentage} />
    </div>
  );
}

/**
 * A density-colored confusion matrix. Rows are ground-truth labels, columns
 * are predicted labels, and the two label sets are independent so any N×M
 * shape renders. The component is fluid-width and self-contained — drop it
 * in a `ChartPanel`, a card, or a page section.
 */
export function ConfusionMatrix({
  data,
  actualLabels: actualLabelsProp,
  predictedLabels: predictedLabelsProp,
  colorInterpolator,
  scaleType = "log",
  size = "M",
  maxCount: maxCountProp,
  showTotals = true,
  showPercentage = false,
  showQuadrantLabels = false,
  showLegend = true,
  legendLabel,
  actualAxisLabel = "actual",
  predictedAxisLabel = "predicted",
}: ConfusionMatrixProps) {
  const defaultColorInterpolator = useDefaultConfusionMatrixColorInterpolator();
  const interpolator = colorInterpolator ?? defaultColorInterpolator;
  const {
    actualLabels,
    predictedLabels,
    counts,
    rowTotals,
    columnTotals,
    total,
    maxCount: computedMaxCount,
  } = computeConfusionMatrix({
    data,
    actualLabels: actualLabelsProp,
    predictedLabels: predictedLabelsProp,
  });
  const maxCount = maxCountProp ?? computedMaxCount;

  // With no labels on either axis there is no grid to draw, and an empty
  // frame reads as a rendering failure rather than as an empty result.
  if (actualLabels.length === 0 || predictedLabels.length === 0) {
    return null;
  }

  // Quadrant labels are only meaningful when both axes list the same two
  // labels in the same (positive-first) order — a mismatched or reordered
  // axis would silently tag the wrong cells TP/FN/FP/TN.
  const showQuadrants =
    showQuadrantLabels && hasAlignedBinaryLabels(actualLabels, predictedLabels);
  const gridTemplateColumns = `minmax(min-content, max-content) repeat(${predictedLabels.length}, minmax(0, 1fr))${
    showTotals ? " minmax(var(--global-dimension-size-800), max-content)" : ""
  }`;

  return (
    <div className="confusion-matrix" css={confusionMatrixCSS} data-size={size}>
      <div className="confusion-matrix__body">
        <div
          className={classNames("confusion-matrix__y-axis-label", {
            "confusion-matrix__y-axis-label--with-totals": showTotals,
          })}
        >
          {actualAxisLabel}
        </div>
        <div className="confusion-matrix__grid" style={{ gridTemplateColumns }}>
          <div />
          <div
            className="confusion-matrix__x-axis-label"
            style={{ gridColumn: `span ${predictedLabels.length}` }}
          >
            {predictedAxisLabel}
          </div>
          {showTotals && <div />}
          <div />
          {predictedLabels.map((label) => (
            <div key={label} className="confusion-matrix__column-header">
              {label}
            </div>
          ))}
          {showTotals && (
            <div className="confusion-matrix__column-header confusion-matrix__column-header--total">
              total
            </div>
          )}
          {actualLabels.map((actualLabel, rowIndex) => (
            <Fragment key={actualLabel}>
              <div className="confusion-matrix__row-header">{actualLabel}</div>
              {predictedLabels.map((predictedLabel, columnIndex) => (
                <MatrixCell
                  key={predictedLabel}
                  count={counts[rowIndex][columnIndex]}
                  total={total}
                  maxCount={maxCount}
                  scaleType={scaleType}
                  colorInterpolator={interpolator}
                  showPercentage={showPercentage}
                  quadrantLabel={
                    showQuadrants
                      ? BINARY_CONFUSION_QUADRANTS[rowIndex][columnIndex]
                      : undefined
                  }
                />
              ))}
              {showTotals && (
                <div className="confusion-matrix__total">
                  <CellValue
                    count={rowTotals[rowIndex]}
                    total={total}
                    showPercentage={showPercentage}
                  />
                </div>
              )}
            </Fragment>
          ))}
          {showTotals && (
            <>
              <div className="confusion-matrix__row-header confusion-matrix__row-header--total">
                total
              </div>
              {columnTotals.map((columnTotal, columnIndex) => (
                <div
                  key={predictedLabels[columnIndex]}
                  className="confusion-matrix__total"
                >
                  {/* Column totals skip the percentage to keep the bottom row quiet */}
                  <CellValue
                    count={columnTotal}
                    total={total}
                    showPercentage={false}
                  />
                </div>
              ))}
              <div className="confusion-matrix__total confusion-matrix__total--grand">
                <CellValue count={total} total={total} showPercentage={false} />
              </div>
            </>
          )}
        </div>
      </div>
      {showLegend && (
        <ConfusionMatrixLegend
          colorInterpolator={interpolator}
          label={legendLabel ?? `count · ${scaleType} scale`}
        />
      )}
    </div>
  );
}
