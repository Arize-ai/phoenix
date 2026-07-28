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
  flex: 1 1 auto;
  // lets the scroll wrapper below be shorter than its content
  min-height: 0;
`;

const scrollWrapCSS = css`
  flex: 1 1 auto;
  overflow: auto;
`;

const resizableTableCSS = css`
  // cells take the width the drag left them at, not their content's
  table-layout: fixed;
`;

/**
 * A table over data already in hand: sortable and resizable columns, columns
 * that can be pinned to the right edge, and rows that either clip to a line or
 * open up to their full height.
 *
 * Takes an emotion `css` prop, which lands on the container. Cells carry
 * {@link TABLE_DATA_CELL_CLASS}, so a caller can reach them with
 * `td.table__cell`.
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
  defaultSorting?: SortingState;
  pinnedRightColumnIds?: string[];
  /** @default false */
  areRowsExpanded?: boolean;
  /** Rendered above the table, outside the part that scrolls */
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
          // the resized columns decide the width; minWidth keeps the table
          // filling the container when they add up to less than it
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
