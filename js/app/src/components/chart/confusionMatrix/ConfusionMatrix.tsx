import { Fragment } from "react";

import type { ComponentSize } from "@phoenix/components/core/types";
import { Truncate } from "@phoenix/components/core/utility/Truncate";
import { classNames } from "@phoenix/utils/classNames";
import { formatInt, formatPercent } from "@phoenix/utils/numberFormatUtils";

import type { SequentialColorInterpolator } from "../colors";
import { useSequentialBlueColorInterpolator } from "../colors";
import { ConfusionMatrixLegend } from "./ConfusionMatrixLegend";
import type {
  ConfusionMatrixDatum,
  ConfusionMatrixScaleType,
} from "./confusionMatrixUtils";
import {
  computeConfusionMatrix,
  createConfusionMatrixDensityScale,
  getConfusionMatrixCellColors,
  getConfusionQuadrantLabels,
} from "./confusionMatrixUtils";
import { confusionMatrixCSS } from "./styles";

export type ConfusionMatrixProps = {
  /**
   * Flat (actual, predicted, count) records; the matrix is pivoted from these
   */
  data: ConfusionMatrixDatum[];
  /**
   * Explicit row (ground truth) labels and order. Derived from the data in
   * first-seen order when omitted.
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
   * `createSequentialColorInterpolator`, both from
   * `@phoenix/components/chart`). Defaults to the theme-aware Phoenix
   * sequential blues, which gain color with density.
   */
  colorInterpolator?: SequentialColorInterpolator;
  /**
   * How counts map to color density. Switch to 'log' when one dominant cell
   * (typically the true-negative) washes out the rest.
   * @default 'linear'
   */
  scaleType?: ConfusionMatrixScaleType;
  /**
   * The display size of the matrix cells and their text
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
   * The label of the positive class. When both axes hold exactly this label
   * and one shared negative label, the four cells are tagged TP / FN / FP /
   * TN — derived by label identity, so axis order doesn't matter. Ignored
   * for any other matrix shape.
   */
  positiveLabel?: string;
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
 * A cell's count, with its share of `percentOf` underneath when given.
 */
function CellValue({
  count,
  percentOf,
}: {
  count: number;
  percentOf?: number;
}) {
  return (
    <>
      <span className="confusion-matrix__count">{formatInt(count)}</span>
      {percentOf != null && percentOf > 0 && (
        <span className="confusion-matrix__percentage">
          {formatPercent((count / percentOf) * 100)}
        </span>
      )}
    </>
  );
}

/**
 * One density-colored cell. `colors` carries the fill and ink resolved by
 * the parent's scale; an empty (zero-count) cell omits it and renders muted.
 */
function MatrixCell({
  count,
  colors,
  percentOf,
  quadrantLabel,
}: {
  count: number;
  colors?: { backgroundColor: string; color: string };
  percentOf?: number;
  quadrantLabel?: string;
}) {
  return (
    <div
      className={classNames("confusion-matrix__cell", {
        "confusion-matrix__cell--empty": colors == null,
      })}
      style={colors}
    >
      {quadrantLabel && (
        <span className="confusion-matrix__quadrant">{quadrantLabel}</span>
      )}
      <CellValue count={count} percentOf={percentOf} />
    </div>
  );
}

/**
 * A marginal-total cell; the grand total renders outlined instead of filled.
 */
function TotalCell({
  count,
  percentOf,
  isGrandTotal = false,
}: {
  count: number;
  percentOf?: number;
  isGrandTotal?: boolean;
}) {
  return (
    <div
      className={classNames("confusion-matrix__total", {
        "confusion-matrix__total--grand": isGrandTotal,
      })}
    >
      <CellValue count={count} percentOf={percentOf} />
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
  scaleType = "linear",
  size = "M",
  maxCount: maxCountProp,
  positiveLabel,
  showTotals = true,
  showPercentage = false,
  showLegend = true,
  legendLabel,
  actualAxisLabel = "actual",
  predictedAxisLabel = "predicted",
}: ConfusionMatrixProps) {
  const interpolator = useSequentialBlueColorInterpolator(colorInterpolator);
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

  const density = createConfusionMatrixDensityScale({ maxCount, scaleType });
  const quadrantLabels =
    positiveLabel != null
      ? getConfusionQuadrantLabels({
          actualLabels,
          predictedLabels,
          positiveLabel,
        })
      : null;
  const percentOf = showPercentage ? total : undefined;
  const gridTemplateColumns = [
    "minmax(min-content, max-content)",
    `repeat(${predictedLabels.length}, minmax(0, 1fr))`,
    ...(showTotals
      ? ["minmax(var(--global-dimension-size-800), max-content)"]
      : []),
  ].join(" ");

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
              <Truncate title={label}>{label}</Truncate>
            </div>
          ))}
          {showTotals && (
            <div className="confusion-matrix__column-header confusion-matrix__column-header--total">
              total
            </div>
          )}
          {actualLabels.map((actualLabel, rowIndex) => (
            <Fragment key={actualLabel}>
              <div className="confusion-matrix__row-header">
                <Truncate title={actualLabel}>{actualLabel}</Truncate>
              </div>
              {predictedLabels.map((predictedLabel, columnIndex) => {
                const count = counts[rowIndex][columnIndex];
                return (
                  <MatrixCell
                    key={predictedLabel}
                    count={count}
                    colors={
                      count > 0
                        ? getConfusionMatrixCellColors({
                            colorInterpolator: interpolator,
                            density: density(count),
                          })
                        : undefined
                    }
                    percentOf={percentOf}
                    quadrantLabel={quadrantLabels?.[rowIndex][columnIndex]}
                  />
                );
              })}
              {showTotals && (
                <TotalCell count={rowTotals[rowIndex]} percentOf={percentOf} />
              )}
            </Fragment>
          ))}
          {showTotals && (
            <>
              <div className="confusion-matrix__row-header confusion-matrix__row-header--total">
                total
              </div>
              {/* Column totals skip the percentage to keep the bottom row quiet */}
              {columnTotals.map((columnTotal, columnIndex) => (
                <TotalCell
                  key={predictedLabels[columnIndex]}
                  count={columnTotal}
                />
              ))}
              <TotalCell count={total} isGrandTotal />
            </>
          )}
        </div>
      </div>
      {showLegend && (
        <ConfusionMatrixLegend
          colorInterpolator={interpolator}
          scaleType={scaleType}
          label={legendLabel}
        />
      )}
    </div>
  );
}
