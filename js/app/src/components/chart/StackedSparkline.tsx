import { css } from "@emotion/react";
import type { PointerEvent, ReactNode } from "react";
import { useId, useRef, useState } from "react";
import { TooltipTriggerStateContext } from "react-aria-components";
import { useTooltipTriggerState } from "react-stately";

import { RichTooltip } from "@phoenix/components";
import { useDimensions } from "@phoenix/hooks/useDimensions";

import {
  getSparklineBinExtent,
  getSparklineBinRanges,
  getSparklineDrawingX,
  getSparklineWidth,
  SPARKLINE_DRAWING_WIDTH,
  type SparklineBinRange,
} from "./sparklineAxis";

const containerCSS = css`
  display: block;
  flex: 1 1 auto;
  min-width: 0;
`;

const svgCSS = css`
  display: block;
  width: 100%;
  overflow: visible;
`;

/** One stacked category, e.g. a label, in the order the stacks are built. */
export type StackedSparklineCategory = {
  key: string;
  /** The category's fill, e.g. a design token var. */
  color: string;
};

export interface StackedSparklineProps {
  /**
   * The categories in stacking order, bottom to top. Keep the order stable
   * (e.g. an annotation config's label order) so a category holds its place
   * in every column and on every row.
   */
  categories: ReadonlyArray<StackedSparklineCategory>;
  /**
   * One entry per time bin, in time order: each category's share of the
   * bin, aligned with `categories`, or null for an empty bin. Shares are in
   * [0, 1] and may sum to less than one; the rest of the column stays empty.
   * Every bin keeps its own x position, on the same axis as the Sparkline,
   * so the two align across rows. When there are more bins than the width
   * can resolve, runs of adjacent bins merge into one column whose shares
   * are the weighted mean of theirs (see `weights`).
   */
  values: ReadonlyArray<ReadonlyArray<number> | null>;
  /**
   * Per-bin weights for merging adjacent bins, e.g. how many entities each
   * bin's shares are of. Defaults to equal weights.
   */
  weights?: ReadonlyArray<number>;
  /** Rendered height in pixels. @default 20 */
  height?: number;
  /**
   * Widest the chart grows, in pixels. It otherwise stretches to the width
   * its flex container gives it. Defaults to unbounded.
   */
  maxWidth?: number;
  /**
   * Detail for a hovered column, shown in a tooltip. Receives the range of
   * source bins the column covers, a single bin unless bins were merged, and
   * the column's merged shares. Only non-empty columns are passed. Omit for
   * a non-interactive chart.
   */
  renderBinDetail?: (detail: StackedSparklineBinDetail) => ReactNode;
  /** Accessible description of what the chart shows. */
  "aria-label"?: string;
}

/** A hovered column, as `renderBinDetail` receives it. */
export type StackedSparklineBinDetail = {
  range: SparklineBinRange;
  /** Each category's merged share, aligned with `categories`. */
  shares: ReadonlyArray<number>;
  /** The total weight behind the column. */
  weight: number;
};

/** The gap between adjacent columns, in pixels at any width. */
const COLUMN_GAP = 1;

/** How far the columns other than the hovered one fade. */
const UNHOVERED_COLUMN_OPACITY = 0.35;

type StackedColumn = {
  position: number;
  range: SparklineBinRange;
  /** Each category's share, or null when the column covers no data. */
  shares: number[] | null;
  weight: number;
};

/**
 * The drawn columns: source bins merged in equal-length runs, the same runs
 * the Sparkline draws at this width, with each category's share the
 * weighted mean over the bins that hold data.
 */
export function getStackedSparklineColumns({
  values,
  weights,
  categoryCount,
  width,
}: {
  values: ReadonlyArray<ReadonlyArray<number> | null>;
  weights: ReadonlyArray<number> | undefined;
  categoryCount: number;
  width: number;
}): StackedColumn[] {
  return getSparklineBinRanges({ binCount: values.length, width }).map(
    (range, position) => {
      const sums = new Array<number>(categoryCount).fill(0);
      let totalWeight = 0;
      for (let index = range.start; index <= range.end; index++) {
        const shares = values[index];
        const weight = weights?.[index] ?? 1;
        if (shares == null || weight <= 0) {
          continue;
        }
        for (let category = 0; category < categoryCount; category++) {
          sums[category] += (shares[category] ?? 0) * weight;
        }
        totalWeight += weight;
      }
      return {
        position,
        range,
        shares: totalWeight > 0 ? sums.map((sum) => sum / totalWeight) : null,
        weight: totalWeight,
      };
    }
  );
}

/**
 * A small stacked-column chart for table cells: one column per time bin,
 * each split into its categories' shares, on the Sparkline's time axis. The
 * categorical counterpart of the Sparkline: where a score has a level per
 * bin, a set of labels has a split per bin. Columns share the Sparkline's
 * x positions, bin merging and max width, so the two line up when stacked
 * in a table column, and empty bins stay blank, so a series ending early
 * visibly stops short. With `renderBinDetail`, hovering a column shows its
 * detail and fades the others. Renders nothing when no bin holds data.
 */
export function StackedSparkline({
  categories,
  values,
  weights,
  height = 20,
  maxWidth,
  renderBinDetail,
  "aria-label": ariaLabel,
}: StackedSparklineProps) {
  const titleId = useId();
  const containerRef = useRef<HTMLSpanElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const dimensions = useDimensions(containerRef);
  const [hoveredPosition, setHoveredPosition] = useState<number | null>(null);
  // Driven by the pointer tracking below rather than a TooltipTrigger, so
  // the state is created and provided here (as the Sparkline does).
  const tooltipState = useTooltipTriggerState({
    isOpen: hoveredPosition != null,
    delay: 0,
  });
  const width = getSparklineWidth({
    measuredWidth: dimensions?.width,
    maxWidth,
  });
  const columns = getStackedSparklineColumns({
    values,
    weights,
    categoryCount: categories.length,
    width,
  });
  const filledColumns = columns.filter((column) => column.shares != null);
  if (filledColumns.length === 0) {
    return null;
  }
  const binCount = values.length;
  const hoveredColumn =
    hoveredPosition == null
      ? null
      : (filledColumns.find((column) => column.position === hoveredPosition) ??
        null);
  const columnInset = ((COLUMN_GAP / 2) * SPARKLINE_DRAWING_WIDTH) / width;
  const onPointerMove =
    renderBinDetail == null
      ? undefined
      : (event: PointerEvent<SVGSVGElement>) => {
          const drawingX = getSparklineDrawingX({
            clientX: event.clientX,
            rect: event.currentTarget.getBoundingClientRect(),
          });
          if (drawingX == null) {
            return;
          }
          // The column under the pointer, or the nearest one with data
          const nearest = filledColumns.reduce((closest, column) => {
            const distance = (candidate: StackedColumn) => {
              const { left, right } = getSparklineBinExtent({
                range: candidate.range,
                binCount,
              });
              return drawingX < left
                ? left - drawingX
                : drawingX > right
                  ? drawingX - right
                  : 0;
            };
            return distance(column) < distance(closest) ? column : closest;
          });
          setHoveredPosition(nearest.position);
        };
  return (
    <span
      ref={containerRef}
      className="stacked-sparkline"
      css={containerCSS}
      style={{ height, maxWidth }}
    >
      <svg
        ref={svgRef}
        css={svgCSS}
        style={{ height }}
        viewBox={`0 0 ${SPARKLINE_DRAWING_WIDTH} ${height}`}
        preserveAspectRatio="none"
        role="img"
        aria-hidden={ariaLabel == null || undefined}
        aria-labelledby={ariaLabel != null ? titleId : undefined}
        onPointerMove={onPointerMove}
        onPointerLeave={
          renderBinDetail == null ? undefined : () => setHoveredPosition(null)
        }
      >
        {ariaLabel != null ? <title id={titleId}>{ariaLabel}</title> : null}
        {filledColumns.map((column) => {
          const { left, right } = getSparklineBinExtent({
            range: column.range,
            binCount,
          });
          const x = left + columnInset;
          const columnWidth = Math.max(0, right - left - 2 * columnInset);
          let top = height;
          return (
            <g
              key={column.position}
              className="stacked-sparkline__column"
              data-position={column.position}
              opacity={
                hoveredColumn == null || hoveredColumn === column
                  ? 1
                  : UNHOVERED_COLUMN_OPACITY
              }
            >
              {categories.map((category, index) => {
                const share = column.shares?.[index] ?? 0;
                if (share <= 0) {
                  return null;
                }
                const segmentHeight = share * height;
                top -= segmentHeight;
                return (
                  <rect
                    key={category.key}
                    className="stacked-sparkline__segment"
                    data-category={category.key}
                    x={x.toFixed(2)}
                    y={top.toFixed(2)}
                    width={columnWidth.toFixed(2)}
                    height={segmentHeight.toFixed(2)}
                    fill={category.color}
                  />
                );
              })}
            </g>
          );
        })}
      </svg>
      {renderBinDetail != null &&
      hoveredColumn != null &&
      hoveredColumn.shares != null ? (
        <TooltipTriggerStateContext.Provider value={tooltipState}>
          <RichTooltip triggerRef={svgRef} placement="top" offset={4}>
            {renderBinDetail({
              range: hoveredColumn.range,
              shares: hoveredColumn.shares,
              weight: hoveredColumn.weight,
            })}
          </RichTooltip>
        </TooltipTriggerStateContext.Provider>
      ) : null}
    </span>
  );
}
