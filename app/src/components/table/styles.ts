import { CSSProperties } from "react";
import { Column } from "@tanstack/react-table";
import { css } from "@emotion/react";

export const tableCSS = css`
  // fixes table row sizing issues with full height cell children
  // this enables features like hovering anywhere on a cell to display controls
  height: fit-content;
  font-size: var(--ac-global-font-size-s);
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  thead {
    position: sticky;
    top: 0;
    z-index: 1;
    tr {
      th {
        padding: var(--ac-global-dimension-size-50)
          var(--ac-global-dimension-size-200);
        background-color: var(--ac-global-color-grey-100);
        position: relative;
        text-align: left;
        user-select: none;
        border-bottom: 1px solid var(--ac-global-border-color-default);
        &:not(:last-of-type) {
          border-right: 1px solid var(--ac-global-border-color-default);
        }
        .cursor-pointer {
          cursor: pointer;
        }
        .sort-icon {
          margin-left: var(--ac-global-dimension-size-50);
          font-size: var(--ac-global-font-size-xs);
          vertical-align: middle;
          display: inline-block;
        }
        &:hover .resizer {
          background: var(--ac-global-color-grey-300);
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
            background: var(--ac-global-color-primary);
          }
        }
        // Style action menu buttons in the header
        .ac-button[data-size="compact"][data-childless="true"] {
          padding: 0;
          border: none;
          background-color: transparent;
        }
      }
    }
  }
  tbody:not(.is-empty) {
    tr {
      // when paired with table.height:fit-content, allows table cells and their children to fill entire row height
      height: 100%;
      &:not(:last-of-type) {
        & > td {
          border-bottom: 1px solid var(--ac-global-border-color-default);
        }
      }
      &:hover {
        background-color: rgba(var(--ac-global-color-grey-300-rgb), 0.3);
      }
      & > td {
        padding: var(--ac-global-dimension-size-100)
          var(--ac-global-dimension-size-200);
      }
      &[data-selected="true"] {
        background-color: var(--ac-global-color-primary-100);
      }
    }
  }
`;

export const borderedTableCSS = css`
  tbody:not(.is-empty) {
    tr {
      & > td {
        border-bottom: 1px solid var(--ac-global-border-color-default);
      }
      & > td:not(:last-of-type) {
        border-right: 1px solid var(--ac-global-border-color-default);
      }
    }
  }
`;

export const selectableTableCSS = css(
  tableCSS,
  css`
    tbody:not(.is-empty) {
      tr {
        cursor: pointer;
      }
    }
  `
);

export const paginationCSS = css`
  display: flex;
  justify-content: flex-end;
  align-items: center;
  padding: var(--ac-global-dimension-size-100);
  gap: var(--ac-global-dimension-size-50);
  border-top: 1px solid var(--ac-global-color-grey-300);
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
    boxShadow: isLastLeftPinnedColumn
      ? "-8px 0 8px -8px var(--ac-global-color-grey-200) inset"
      : isFirstRightPinnedColumn
        ? "8px 0 8px -8px var(--ac-global-color-grey-200) inset"
        : undefined,
    left: isPinned === "left" ? `${column.getStart("left")}px` : undefined,
    right: isPinned === "right" ? `${column.getAfter("right")}px` : undefined,
    opacity: isPinned ? 0.95 : 1,
    position: isPinned ? "sticky" : "relative",
    width: column.getSize(),
    zIndex: isPinned ? 1 : 0,
  };
}
