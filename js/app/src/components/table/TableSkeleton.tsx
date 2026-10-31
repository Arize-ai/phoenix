import { css } from "@emotion/react";
import type { HTMLAttributes, Ref, RefObject } from "react";
import { useLayoutEffect, useRef, useState } from "react";

import type { EdgeFadeEdge } from "@phoenix/components/core/layout";
import { edgeFadeCSS } from "@phoenix/components/core/layout";
import { Skeleton } from "@phoenix/components/core/loading";
import { breakpoints } from "@phoenix/constants/breakpoints";
import { classNames } from "@phoenix/utils/classNames";

const ROW_CELL_POSITIONS = [
  "outer",
  "inner",
  "middle",
  "inner",
  "outer",
] as const;

const tableSkeletonCSS = css`
  container-type: inline-size;
  /* A loaded row also carries a 1px bottom border, which the skeleton leaves
     out, so the rows still stand where the loaded rows will. */
  --table-skeleton-row-height: calc(
    var(--global-line-height-s) + 2 * var(--global-table-cell-padding-y) + 1px
  );
  --table-skeleton-item-size: var(--global-dimension-size-200);
  &[data-fill="true"] {
    display: flex;
    flex-direction: column;
    flex: 1 1 auto;
    height: 100%;
    min-height: 0;
    overflow: hidden;
  }
  &[data-fill="true"] .table-skeleton__body {
    flex: 1 1 0;
    min-height: 0;
    overflow: hidden;
  }
  &[data-fade-edge="bottom"] .table-skeleton__body {
    ${edgeFadeCSS("bottom")}
  }
  .table-skeleton__toolbar {
    flex: none;
    padding: var(--global-dimension-size-100) var(--global-dimension-size-200);
  }
  .table-skeleton__header,
  .table-skeleton__row {
    display: flex;
    align-items: center;
    gap: var(--global-dimension-size-200);
    box-sizing: border-box;
    padding-inline: var(--global-table-cell-padding-x);
  }
  .table-skeleton__header {
    height: var(--global-table-header-height);
  }
  .table-skeleton__row {
    height: var(--table-skeleton-row-height);
  }
  .table-skeleton__selection {
    display: flex;
    flex: none;
  }
  .table-skeleton__bar {
    flex: 1 1 0;
    min-width: 0;
  }
  .table-skeleton__cell {
    flex: 0 1 var(--global-dimension-size-2400);
    min-width: 0;
  }
  .table-skeleton__cell[data-position="middle"] {
    flex-grow: 1;
  }
  @container (width < ${breakpoints.lg}px) {
    .table-skeleton__cell[data-position="outer"] {
      display: none;
    }
    .table-skeleton__cell {
      flex-basis: var(--global-dimension-size-2000);
    }
  }
`;

export interface TableSkeletonProps extends HTMLAttributes<HTMLDivElement> {
  ref?: Ref<HTMLDivElement>;
  /**
   * The number of placeholder rows, or `"fill"` to fill the height of the
   * container with as many rows as fit. Fill when the loaded table fills its
   * container; the container must then have a definite height, or be a flex
   * column whose remaining height the skeleton takes.
   * @default 10
   */
  rowCount?: number | "fill";
  /**
   * Whether the loaded table has a row-selection checkbox column. Each row
   * then leads with a checkbox placeholder.
   * @default false
   */
  isSelectable?: boolean;
  /**
   * Whether the loaded table has a toolbar above its header, such as a filter
   * field. A toolbar-height bar then leads the skeleton.
   * @default false
   */
  hasToolbar?: boolean;
  /**
   * The edge toward which the rows fade to transparency, so the table appears
   * to continue beyond it, or `null` for no fade. The toolbar and header do
   * not fade. A filling table runs on past its container, so it fades toward
   * the bottom unless told otherwise.
   * @default 'bottom' when `rowCount` is `"fill"`, otherwise `null`
   */
  fadeEdge?: EdgeFadeEdge | null;
}

/**
 * A loading placeholder for a table: an optional toolbar bar, a header of one
 * bar, and rows of five cells, of which the outer two drop out when the
 * skeleton is narrower than the large breakpoint. It takes the table's header
 * and row heights, so the rows stand where the loaded rows will, and draws
 * nothing but skeletons.
 */
export function TableSkeleton({
  ref,
  rowCount = 10,
  isSelectable = false,
  hasToolbar = false,
  fadeEdge,
  className,
  ...props
}: TableSkeletonProps) {
  const isFill = rowCount === "fill";
  const resolvedFadeEdge =
    fadeEdge === undefined && isFill ? "bottom" : fadeEdge;
  const bodyRef = useRef<HTMLDivElement>(null);
  const fillRowCount = useFillRowCount(bodyRef, isFill);
  const renderedRowCount = isFill ? fillRowCount : rowCount;
  return (
    <div
      role="status"
      aria-label="loading"
      ref={ref}
      className={classNames(className, "table-skeleton")}
      css={tableSkeletonCSS}
      data-fill={isFill}
      data-fade-edge={resolvedFadeEdge ?? undefined}
      {...props}
    >
      {hasToolbar ? (
        <div className="table-skeleton__toolbar" aria-hidden>
          <Skeleton height="var(--global-input-height-m)" />
        </div>
      ) : null}
      <div className="table-skeleton__header" aria-hidden>
        <Skeleton
          className="table-skeleton__bar"
          height="var(--global-dimension-size-225)"
        />
      </div>
      <div ref={bodyRef} className="table-skeleton__body">
        {Array.from({ length: renderedRowCount }, (_, rowIndex) => (
          <div key={rowIndex} className="table-skeleton__row" aria-hidden>
            {isSelectable ? <SelectionSkeleton /> : null}
            {ROW_CELL_POSITIONS.map((position, cellIndex) => (
              <Skeleton
                key={cellIndex}
                className="table-skeleton__cell"
                data-position={position}
                height="var(--table-skeleton-item-size)"
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

TableSkeleton.displayName = "TableSkeleton";

/**
 * The number of rows that fill the body's height, counting a last row that is
 * only partly visible. It renders one row first to measure the row height,
 * and measures in a layout effect so the filled rows appear on the first
 * paint.
 */
function useFillRowCount(
  bodyRef: RefObject<HTMLDivElement | null>,
  isFill: boolean
) {
  const [rowCount, setRowCount] = useState(1);
  useLayoutEffect(() => {
    const body = bodyRef.current;
    if (!isFill || !body) return undefined;
    const update = () => {
      const rowHeight = body.firstElementChild?.getBoundingClientRect().height;
      if (!rowHeight) return;
      setRowCount(Math.max(1, Math.ceil(body.clientHeight / rowHeight)));
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(body);
    return () => observer.disconnect();
  }, [bodyRef, isFill]);
  return rowCount;
}

function SelectionSkeleton() {
  return (
    <span className="table-skeleton__selection">
      <Skeleton
        width="var(--table-skeleton-item-size)"
        height="var(--table-skeleton-item-size)"
      />
    </span>
  );
}
