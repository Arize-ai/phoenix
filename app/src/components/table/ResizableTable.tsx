import { css } from "@emotion/react";
import type { ColumnDef, SortingState } from "@tanstack/react-table";
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import type { ReactNode } from "react";
import { useState } from "react";

import {
  expandableRowsTableCSS,
  getCommonPinningStyles,
  TABLE_DATA_CELL_CLASS,
  tableCSS,
} from "./styles";
import { TableColumnHeader } from "./TableColumnHeader";
import { TableEmpty } from "./TableEmpty";

const containerCSS = css`
  display: flex;
  flex-direction: column;
  // fills a flex column and is inert inside a card, whose body is a block
  flex: 1 1 auto;
  // the scrolling happens below, so this must be free to be shorter than it
  min-height: 0;
`;

const scrollWrapCSS = css`
  flex: 1 1 auto;
  // the columns can be dragged wider than the container, and there can be more
  // rows than fit, so this is the element that scrolls in both directions
  overflow: auto;
`;

const resizableTableCSS = css`
  // columns are resizable, so cells take the width the drag left them at
  // rather than sizing themselves to their content
  table-layout: fixed;
`;

/**
 * A table over data already in hand: sortable and resizable columns, columns
 * that can be pinned to the right edge, and rows that either clip to a line or
 * open up to their full height.
 *
 * Everything above the table — an error, a toolbar — goes in `banner`, which is
 * held outside the scrolling area so it stays put while the table is scrolled.
 *
 * Styled through the emotion `css` prop, which lands on the container: the
 * cells carry {@link TABLE_DATA_CELL_CLASS}, so a caller can reach them with
 * `td.table__cell` without needing a class of its own.
 */
export function ResizableTable<DataRow>({
  columns,
  data,
  defaultSorting,
  pinnedRightColumnIds,
  areRowsExpanded = false,
  banner,
  className,
  "data-testid": dataTestId,
}: {
  columns: ColumnDef<DataRow>[];
  data: DataRow[];
  /** How the table is sorted until the reader sorts it themselves */
  defaultSorting?: SortingState;
  /** Columns stuck to the table's right edge as the rest scroll under them */
  pinnedRightColumnIds?: string[];
  /**
   * Whether a row wraps its content over as many lines as it needs, or is
   * clipped to a single line so the rows can be scanned down an even grid.
   * Pair with `RowExpandToggleButton` to let the reader switch.
   * @default false
   */
  areRowsExpanded?: boolean;
  /** Rendered above the table, outside the part of it that scrolls */
  banner?: ReactNode;
  className?: string;
  "data-testid"?: string;
}) {
  "use no memo";
  const [sorting, setSorting] = useState<SortingState>(defaultSorting ?? []);
  // eslint-disable-next-line react-hooks-js/incompatible-library
  const table = useReactTable({
    columns,
    data,
    defaultColumn: {
      minSize: 60,
    },
    columnResizeMode: "onChange",
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
    state: {
      sorting,
      columnPinning: {
        right: pinnedRightColumnIds,
      },
    },
  });
  const rows = table.getRowModel().rows;

  return (
    <div css={containerCSS} className={className}>
      {banner}
      <div css={scrollWrapCSS}>
        <table
          css={[tableCSS, expandableRowsTableCSS, resizableTableCSS]}
          // the resized columns decide the table's width; it still fills the
          // container when they add up to less than it
          style={{ width: table.getTotalSize(), minWidth: "100%" }}
          data-rows={areRowsExpanded ? "expanded" : "collapsed"}
          data-testid={dataTestId}
        >
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableColumnHeader
                    key={header.id}
                    header={header}
                    style={getCommonPinningStyles(header.column)}
                  />
                ))}
              </tr>
            ))}
          </thead>
          {rows.length === 0 ? (
            <TableEmpty />
          ) : (
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className={TABLE_DATA_CELL_CLASS}
                      align={cell.column.columnDef.meta?.textAlign}
                      style={getCommonPinningStyles(cell.column)}
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          )}
        </table>
      </div>
    </div>
  );
}
