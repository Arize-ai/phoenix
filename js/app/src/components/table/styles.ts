import { css } from "@emotion/react";
import type { Column } from "@tanstack/react-table";
import type { CSSProperties } from "react";

import { truncateSingleCSS } from "@phoenix/components/core/utility/Truncate";

/**
 * Marks a `<td>` that holds one column's value, as opposed to the cells that
 * stand in for a whole row (empty state, load more). Table bodies put it on
 * every cell they render from a column definition.
 */
export const TABLE_DATA_CELL_CLASS = "table__cell";

export const tableCSS = css`
  // fixes table row sizing issues with full height cell children
  // this enables features like hovering anywhere on a cell to display controls
  height: fit-content;
  font-size: var(--global-font-size-s);
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  thead {
    position: sticky;
    top: 0;
    z-index: 2;
    background-color: var(--global-table-header-background-color);
    tr {
      th {
        box-sizing: border-box;
        height: var(--global-table-header-height);
        padding: var(--global-table-cell-padding-y)
          var(--global-table-cell-padding-x);
        position: relative;
        text-align: left;
        user-select: none;
        vertical-align: top;
        font-weight: 600;
        font-size: var(--global-font-size-s);
        line-height: var(--global-line-height-s);
        border-bottom: 1px solid var(--global-border-color-default);
        &:not(:last-of-type) {
          border-right: 1px solid var(--global-border-color-default);
        }
        .sort {
          /* The sortable part of the header */
          cursor: pointer;
          display: flex;
          flex-direction: row;
          align-items: center;

          gap: var(--global-dimension-size-50);
        }
        .sort-icon {
          margin-left: var(--global-dimension-size-50);
          font-size: var(--global-font-size-xs);
          vertical-align: middle;
          display: inline-block;
        }
        &:hover .resizer {
          background: var(--hover-background);
        }
        div.resizer {
          display: inline-block;

          width: 2px;
          height: 100%;
          position: absolute;
          right: 0;
          top: 0;
          cursor: grab;
          z-index: 4;
          touch-action: none;
          &.isResizing,
          &:hover {
            background: var(--global-color-primary);
          }
        }
        // Style action menu buttons in the header
        .button[data-size="compact"][data-childless="true"] {
          padding: 0;
          border: none;
          background-color: transparent;
        }
      }
    }
  }
  // Right-aligned columns (numbers), driven by the column's meta.textAlign.
  // text-align handles inline content, but the flex-row cell components
  // (latency, token counts, costs) don't respond to it, so the row itself is
  // pushed to the cell's end to keep digits on a shared right edge.
  th[align="right"] {
    text-align: right;
    .sort {
      justify-content: flex-end;
    }
  }
  td[align="right"] {
    // justify-content is inert on non-flex children, so this reaches the
    // flex-row cell components without naming them
    > * {
      justify-content: flex-end;
    }
  }
  tbody:not(.is-empty) {
    tr {
      // when paired with table.height:fit-content, allows table cells and their children to fill entire row height
      height: 100%;
      &:not(:last-of-type) {
        & > td {
          border-bottom: 1px solid var(--global-table-row-border-color);
        }
      }
      & > td {
        padding: var(--global-table-cell-padding-y)
          var(--global-table-cell-padding-x);
      }
      &[data-selected="true"] {
        background-color: var(--global-table-row-selected-background-color);
      }
    }
  }
`;

export const borderedTableCSS = css`
  tbody:not(.is-empty) {
    tr {
      & > td {
        border-bottom: 1px solid var(--global-table-bordered-cell-border-color);
      }
      & > td:not(:last-of-type) {
        border-right: 1px solid var(--global-table-bordered-cell-border-color);
      }
    }
  }
`;

export const interactiveTableCSS = css`
  tbody:not(.is-empty) {
    tr {
      &:hover {
        background-color: var(--hover-background);
      }
    }
  }
`;

export const selectableTableCSS = css(
  tableCSS,
  interactiveTableCSS,
  css`
    tbody:not(.is-empty) {
      tr {
        cursor: pointer;
      }
    }
  `
);

/**
 * Row-height states for tables with an expand/collapse rows toggle, applied
 * via a `data-rows="collapsed" | "expanded"` attribute on the `<table>`.
 * Collapsed clips every cell to a single ellipsized line so rows keep an even
 * height and the table scans as a grid; expanded lets cells wrap and grow,
 * top-aligned so a row's cells all start on the same line.
 */
export const expandableRowsTableCSS = css`
  // Only data cells take a row height; the cells that stand in for a whole row
  // (empty state, load more) lay themselves out.
  &[data-rows="collapsed"] {
    td.${TABLE_DATA_CELL_CLASS} {
      ${truncateSingleCSS};
      // a <pre> would keep its newlines and outgrow the single line; it also
      // overflows on its own terms, so the cell's ellipsis is repeated here
      pre {
        white-space: inherit;
        overflow: hidden;
        text-overflow: ellipsis;
      }
    }
  }
  &[data-rows="expanded"] {
    td.${TABLE_DATA_CELL_CLASS} {
      vertical-align: top;
      overflow: hidden;
      // long unbroken values (ids, serialized JSON) wrap within the cell
      // rather than widening the column
      overflow-wrap: anywhere;
    }
  }
`;

/**
 * Selectable rows plus the row-height states the toolbar toggle drives, composed
 * once so the tables that offer it cannot answer the same question differently.
 */
export const expandableSelectableTableCSS = css(
  selectableTableCSS,
  expandableRowsTableCSS
);

export const paginationCSS = css`
  display: flex;
  justify-content: flex-end;
  align-items: center;
  padding: var(--global-table-pagination-padding);
  gap: var(--global-table-pagination-gap);
  border-top: 1px solid var(--global-table-pagination-border-color);
`;

//These are the important styles to make sticky column pinning work!
//Apply styles like this using your CSS strategy of choice with this kind of logic to head cells, data cells, footer cells, etc.
//View the index.css file for more needed styles such as border-collapse: separate
export function getCommonPinningStyles<Row>(
  column: Column<Row>
): CSSProperties {
  const isPinned = column.getIsPinned();
  const isLastLeftPinnedColumn =
    isPinned === "left" && column.getIsLastColumn("left");
  const isFirstRightPinnedColumn =
    isPinned === "right" && column.getIsFirstColumn("right");

  return {
    borderRight: isLastLeftPinnedColumn
      ? "1px solid var(--global-border-color-default)"
      : undefined,
    borderLeft: isFirstRightPinnedColumn
      ? "1px solid var(--global-border-color-default)"
      : undefined,
    left: isPinned === "left" ? `${column.getStart("left")}px` : undefined,
    right: isPinned === "right" ? `${column.getAfter("right")}px` : undefined,
    opacity: 1,
    position: isPinned ? "sticky" : "relative",
    width: column.getSize(),
    zIndex: isPinned ? 1 : 0,
    backgroundColor: isPinned
      ? "var(--global-table-pinned-column-background-color)"
      : undefined,
  };
}
