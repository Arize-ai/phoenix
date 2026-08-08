import { css } from "@emotion/react";

import { embeddedCopyButtonCSS } from "@phoenix/components/core/copy/styles";
import { borderedTableCSS, tableCSS } from "@phoenix/components/table/styles";

export const jsonTableCSS = css(
  tableCSS,
  borderedTableCSS,
  css`
    // Every cell here carries a copy control, so they take the same quiet
    // square used inside readonly fields and code blocks: short enough to sit
    // within a single line row, and quiet enough that the cell's own text still
    // reads first. Scoped to this table rather than the shared cell wrapper,
    // which every other table in the app also uses.
    ${embeddedCopyButtonCSS}

    // the key column carries an explicit width so it can be dragged; the value
    // column absorbs whatever is left
    table-layout: fixed;
    td {
      // long values wrap within the cell rather than widening the column, and
      // are arbitrary text, so there is no better place to break them
      overflow-wrap: anywhere;
      vertical-align: top;
    }
    // keys carry explicit break opportunities at their path delimiters, so
    // they should only ever break mid-segment when a single segment is itself
    // too long for the column
    td:first-of-type {
      overflow-wrap: break-word;
    }

    // How much of a row is shown is the table's decision rather than each
    // cell's, so both states live here and a cell only says which of the two
    // kinds of text it holds.
    &[data-rows] {
      // the cell wrap lays its children out as flex rows; a block box is what
      // the ellipsis below needs to act on
      .json-table__key,
      .json-table__value {
        display: block;
      }
    }
    // expanded rows are the state in which the content is read rather than
    // scanned, so nothing is cut short: a row grows to as many lines as its
    // longest cell needs
    &[data-rows="collapsed"] {
      .json-table__key,
      .json-table__value {
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      // A key cell marks the break opportunities in its path with <wbr>, the
      // HTML element for "the line may break here". The browser honors one
      // even where the text is set never to wrap, so a collapsed key stays on
      // one line only once they are out of the flow entirely.
      .json-table__key wbr {
        display: none;
      }
    }
  `
);
