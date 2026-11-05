import { css } from "@emotion/react";
import type { RowData } from "@tanstack/react-table";
import type { CSSProperties, ReactNode, RefObject } from "react";
import { useLayoutEffect, useRef, useState } from "react";

import { edgeFadeCSS } from "@phoenix/components/core/layout";
import { Skeleton } from "@phoenix/components/core/loading";

import type { Column, Table } from "./tableFeatures";

/**
 * Bar widths, as a share of the cell's content, cycled across a row's cells
 * and shifted on each row, so the placeholder reads as varied text rather
 * than a grid.
 */
const BAR_WIDTHS = ["72%", "48%", "88%", "60%"] as const;

/**
 * How much of a column's size a placeholder cell fills. A loaded table lays
 * its columns out to their content, which in most columns runs close to the
 * column's size, so the placeholder holds that much and the columns come out
 * at the loaded widths. A column whose content is much narrower sets
 * `meta.skeletonWidth` instead.
 */
const CELL_CONTENT_SHARE = 0.85;

const cellContentCSS = css`
  display: flex;
  align-items: center;
  /* A loaded cell holds one line of text */
  height: var(--global-line-height-s);
  &[data-align="right"] {
    justify-content: flex-end;
    margin-inline-start: auto;
  }
`;

const tableSkeletonContainerCSS = css`
  /* Takes the height the loaded table scrolls in, in a block or a flex
     column, and clips the last, partly visible row rather than scrolling */
  flex: 1 1 auto;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  /* The rows trail off; the header, at the top, stays solid */
  --edge-fade-size: 50%;
  ${edgeFadeCSS("bottom")}
`;

/**
 * The element a skeleton table sits in, in place of the loaded table's scroll
 * container: it announces the table as loading and is the height the
 * {@link TableBodySkeleton} rows fill.
 */
export function TableSkeletonContainer({ children }: { children: ReactNode }) {
  return (
    <div css={tableSkeletonContainerCSS} role="status" aria-label="loading">
      {children}
    </div>
  );
}

/** The rows to draw before the container has been measured. */
const INITIAL_FILL_ROW_COUNT = 20;

/**
 * The style a loaded body cell of the column takes, so a placeholder cell
 * sizes the column the same way. Defaults to the column's size as its width
 * and maximum width.
 */
export type TableBodySkeletonCellStyle<Data extends RowData> = (
  column: Column<Data>
) => CSSProperties;

function getDefaultCellStyle<Data extends RowData>(
  column: Column<Data>
): CSSProperties {
  return {
    width: column.getSize(),
    maxWidth: column.getSize(),
    overflow: "hidden",
    textAlign: column.columnDef.meta?.textAlign,
  };
}

/**
 * Placeholder rows for a table while its data loads, rendered as the table's
 * own `<tbody>`. Render it under the table's real `<thead>`, built from the
 * same column definitions with no rows, so the header, column widths and row
 * heights are exactly those of the loaded table and nothing shifts when the
 * rows arrive. Wrap the table in a {@link TableSkeletonContainer}, which
 * marks it as loading and clips the rows that fill it.
 *
 * @example
 * ```tsx
 * const table = useTable({ features, columns, data: [] });
 * <table css={tableCSS}>
 *   <thead>…</thead>
 *   <TableBodySkeleton table={table} />
 * </table>
 * ```
 */
export function TableBodySkeleton<Data extends RowData>({
  table,
  rowCount = "fill",
  getCellStyle = getDefaultCellStyle,
}: {
  table: Table<Data>;
  /**
   * The number of placeholder rows, or `"fill"` for as many as fit in the
   * height of the element the table scrolls in.
   * @default 'fill'
   */
  rowCount?: number | "fill";
  /** How the loaded table styles a body cell of the column. */
  getCellStyle?: TableBodySkeletonCellStyle<Data>;
}) {
  const bodyRef = useRef<HTMLTableSectionElement>(null);
  const fillRowCount = useFillRowCount(bodyRef, rowCount === "fill");
  const renderedRowCount = rowCount === "fill" ? fillRowCount : rowCount;
  const columns = table.getVisibleLeafColumns();
  return (
    <tbody ref={bodyRef} aria-hidden>
      {Array.from({ length: renderedRowCount }, (_, rowIndex) => (
        <tr key={rowIndex}>
          {columns.map((column, columnIndex) => (
            <td key={column.id} style={getCellStyle(column)}>
              <span
                css={cellContentCSS}
                data-align={column.columnDef.meta?.textAlign}
                style={{
                  width:
                    column.columnDef.meta?.skeletonWidth ??
                    column.getSize() * CELL_CONTENT_SHARE,
                }}
              >
                <Skeleton
                  width={
                    BAR_WIDTHS[(rowIndex + columnIndex) % BAR_WIDTHS.length]
                  }
                  height="var(--global-dimension-size-150)"
                />
              </span>
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  );
}

/**
 * The number of rows that fill the scroll container below the header,
 * counting a last row that is only partly visible. The container is the
 * table's parent; it is measured in a layout effect so the rows appear on the
 * first paint, and again whenever it resizes.
 */
function useFillRowCount(
  bodyRef: RefObject<HTMLTableSectionElement | null>,
  isFill: boolean
) {
  const [rowCount, setRowCount] = useState(INITIAL_FILL_ROW_COUNT);
  useLayoutEffect(() => {
    const body = bodyRef.current;
    const container = body?.closest("table")?.parentElement;
    if (!isFill || !body || !container) return undefined;
    const update = () => {
      const rowHeight = body.firstElementChild?.getBoundingClientRect().height;
      if (!rowHeight) return;
      const headerHeight =
        body.parentElement?.querySelector("thead")?.getBoundingClientRect()
          .height ?? 0;
      setRowCount(
        Math.max(
          1,
          Math.ceil((container.clientHeight - headerHeight) / rowHeight)
        )
      );
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(container);
    return () => observer.disconnect();
  }, [bodyRef, isFill]);
  return rowCount;
}
