import type { ColumnDef, Row, Table } from "@tanstack/react-table";
import type { MouseEvent } from "react";

import { CHECKBOX_COLUMN_ID } from "./constants";
import { IndeterminateCheckboxCell } from "./IndeterminateCheckboxCell";

export type SelectRowHandler<TData> = ({
  event,
  row,
  table,
}: {
  event: MouseEvent;
  row: Row<TData>;
  table: Table<TData>;
}) => void;

/**
 * Creates the standard TanStack row-selection checkbox column.
 *
 * @param params - selection column options
 * @param params.selectRow - optional custom row selection handler
 * @param params.shouldRenderCell - returns false for rows that should not show a checkbox
 * @param params.showSelectAllHeader - renders a "select all" checkbox in the header; disable for single-row-selection tables
 * @param params.size - column size in pixels
 * @param params.minSize - minimum column size in pixels
 * @param params.maxSize - maximum column size in pixels
 */
export function createRowSelectionColumn<TData>({
  selectRow,
  shouldRenderCell = () => true,
  showSelectAllHeader = true,
  size = 30,
  minSize = size,
  maxSize = size,
}: {
  selectRow?: SelectRowHandler<TData>;
  shouldRenderCell?: (row: Row<TData>) => boolean;
  showSelectAllHeader?: boolean;
  size?: number;
  minSize?: number;
  maxSize?: number;
} = {}): ColumnDef<TData> {
  return {
    id: CHECKBOX_COLUMN_ID,
    enableResizing: false,
    enableSorting: false,
    size,
    minSize,
    maxSize,
    header: showSelectAllHeader
      ? ({ table }) => (
          <IndeterminateCheckboxCell
            isSelected={table.getIsAllRowsSelected()}
            isIndeterminate={table.getIsSomeRowsSelected()}
            onChange={table.toggleAllRowsSelected}
          />
        )
      : () => null,
    cell: ({ row, table }) => {
      if (!shouldRenderCell(row)) {
        return null;
      }
      return (
        <IndeterminateCheckboxCell
          isSelected={row.getIsSelected()}
          isDisabled={!row.getCanSelect()}
          isIndeterminate={row.getIsSomeSelected()}
          onChange={row.toggleSelected}
          onCellClick={
            selectRow
              ? (event) => {
                  selectRow({ event, row, table });
                }
              : undefined
          }
        />
      );
    },
  };
}
