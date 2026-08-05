import { css } from "@emotion/react";
import type { ColumnDef, Row } from "@tanstack/react-table";
import type { PropsWithChildren } from "react";

import { EXPAND_COLUMN_ID } from "./constants";
import { TableExpandButton } from "./TableExpandButton";

/**
 * Width of the disclosure column. Wide enough for the chevron and its focus
 * ring, narrow enough to read as a gutter beside the first real column.
 */
export const EXPAND_COLUMN_SIZE = 36;

/**
 * The DOM id of the detail area a row's disclosure control reveals. Shared by
 * the control's `aria-controls` and the detail area itself, so assistive
 * technology can follow one to the other.
 *
 * @param rowId - the table row's id, which must be unique within the page
 */
export function getRowDetailsId(rowId: string) {
  return `row-details-${rowId}`;
}

/**
 * Creates the disclosure column that expands and collapses a row's inline
 * detail area, to be pinned at the leading edge with `EXPAND_COLUMN_PINNING`.
 *
 * Requires `getRowCanExpand` on the table so tanstack treats every row as
 * expandable — without subrows a row can otherwise never be expanded.
 *
 * @param params - expansion column options
 * @param params.getRowLabel - names the row in the control's accessible label,
 *   so a screen reader hears which row it is about to expand
 * @param params.size - column size in pixels
 */
export function createRowExpandColumn<TData>({
  getRowLabel,
  size = EXPAND_COLUMN_SIZE,
}: {
  getRowLabel?: (row: Row<TData>) => string;
  size?: number;
} = {}): ColumnDef<TData> {
  return {
    id: EXPAND_COLUMN_ID,
    header: () => null,
    enableResizing: false,
    enableSorting: false,
    enableHiding: false,
    size,
    minSize: size,
    maxSize: size,
    cell: ({ row }) => {
      const rowLabel = getRowLabel?.(row);
      return (
        <TableExpandButton
          isExpanded={row.getIsExpanded()}
          onClick={row.getToggleExpandedHandler()}
          aria-label={
            rowLabel ? `Toggle details for ${rowLabel}` : "Toggle row details"
          }
          aria-controls={getRowDetailsId(row.id)}
        />
      );
    },
  };
}

const rowDetailsPanelCSS = css`
  // Pinned to the leading edge of the table's scroll port so the detail area
  // stays where it can be read however far the columns are scrolled sideways
  position: sticky;
  left: 0;
  box-sizing: border-box;
  max-width: 100%;
  padding-block: var(--global-dimension-size-200);
  padding-right: var(--global-table-cell-padding-x);
  // Indented past the disclosure column so the detail area starts on the same
  // edge as the row's first value rather than under its chevron
  padding-left: calc(
    ${EXPAND_COLUMN_SIZE}px + var(--global-table-cell-padding-x)
  );
  // Long unbroken values (ids, serialized JSON) wrap here rather than widening
  // the row and forcing the whole table to scroll sideways
  overflow-wrap: anywhere;
`;

export type RowDetailsRowProps = PropsWithChildren<{
  /** The id of the row this detail area belongs to. */
  rowId: string;
  /**
   * How many columns to span, i.e. `table.getVisibleLeafColumns().length`, so
   * the detail area runs the full width of the table.
   */
  colSpan: number;
  /**
   * Width of the table's scroll port in pixels, which the detail area takes so
   * its content lays out against the visible area instead of against a table
   * that may be far wider. Falls back to the full table width when unknown.
   */
  scrollPortWidth?: number;
}>;

/**
 * A table row that renders a detail area inline beneath the row it belongs to,
 * spanning every column.
 *
 * Render it only while the row is expanded, immediately after that row, and
 * style the table with `rowDetailsTableCSS` so the pair reads as one block.
 */
export function RowDetailsRow({
  rowId,
  colSpan,
  scrollPortWidth,
  children,
}: RowDetailsRowProps) {
  return (
    <tr data-row="details">
      <td colSpan={colSpan}>
        <div
          id={getRowDetailsId(rowId)}
          css={rowDetailsPanelCSS}
          style={{ width: scrollPortWidth ?? "100%" }}
        >
          {children}
        </div>
      </td>
    </tr>
  );
}
