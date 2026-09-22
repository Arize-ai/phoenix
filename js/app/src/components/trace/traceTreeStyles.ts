import { css } from "@emotion/react";
import type { CSSProperties } from "react";

export const NESTING_INDENT = 25;
export const COMPACT_BREAKPOINT = "300px";
export const LARGE_BREAKPOINT = "500px";
export const EXTRA_LARGE_BREAKPOINT = "800px";

/**
 * Height of a row's title line. The span kind icon, the timeline bar and the
 * controls are centered on it, and the tree lines meet the icon at its center.
 */
const HEADING_HEIGHT = 20;
/** Width of the left border that marks the selected row. */
const SELECTION_BORDER_WIDTH = 4;
/** Horizontal padding of a row at nesting level 0. */
const ROW_PADDING_X = 16;
const ICON_SIZE = 20;
/**
 * Tree lines stop this far short of the icon on every side, so the icon reads
 * as a node the lines point at rather than one they pierce.
 */
const LINE_GAP = 5;
/**
 * Run and corner radius of the elbow that joins a row to its parent's line.
 * It ends one gap before the icon's left edge.
 */
const ELBOW_SIZE = ROW_PADDING_X - LINE_GAP;
/**
 * Where the vertical tree line sits under a level-0 icon, measured from the
 * list item's left edge. The 1px line hugs the left of the icon's center.
 */
const EDGE_LEFT = SELECTION_BORDER_WIDTH + ROW_PADDING_X + ICON_SIZE / 2 - 1;

/*
 * Tree lines are positioned so they can run through rows, and rows are
 * positioned so their own lines can anchor to them. A positioned row's hover
 * or selection fill would therefore paint over a line that has no z-index, so
 * every line sits one layer up, error lines one more, and the icon above all
 * of them. Colors are set through longhands: the `border-left: 1px solid`
 * shorthand would reset the color to currentColor.
 */
export const TREE_LINE_Z_INDEX = 1;
export const TREE_LINE_ERROR_Z_INDEX = 2;
export const TREE_ICON_Z_INDEX = 3;

/**
 * Sets the tree's nesting depth for the rows and connectors beneath an element.
 * All tree geometry reads the depth from this property so the styles below stay
 * static and are compiled once for the whole tree.
 */
export function nestingLevelStyle(nestingLevel: number) {
  return { "--trace-tree-nesting-level": nestingLevel } as CSSProperties;
}

export const traceTreeListCSS = css`
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  width: 100%;
  --trace-tree-nesting-indent: ${NESTING_INDENT}px;
  --trace-tree-heading-height: ${HEADING_HEIGHT}px;
  --trace-tree-row-padding-y: var(--global-dimension-size-100);
  /* Vertical center of a row's icon, measured from the top of the row */
  --trace-tree-icon-center: calc(
    var(--trace-tree-row-padding-y) + var(--trace-tree-heading-height) / 2
  );
  /* Left edge of the tree line under a level-0 icon, in list item coordinates */
  --trace-tree-edge-offset: ${EDGE_LEFT}px;
  --trace-tree-timing-width: 150px;
  /* Every tree line is drawn in this one color; error lines override it */
  --trace-tree-line-color: var(--global-color-gray-300);
  @container (width < ${COMPACT_BREAKPOINT}) {
    --trace-tree-nesting-indent: 0;
    .span-controls,
    .span-metrics,
    .span-tree-edge-connector,
    .span-tree-edge,
    .span-tree-drop,
    .span-tree-timing {
      display: none;
      visibility: hidden;
      width: 0;
    }
    .span-node-wrap {
      padding-left: var(--global-dimension-size-200);
    }
  }
  @container (width < ${LARGE_BREAKPOINT}) {
    .span-tree-timing {
      display: none;
      visibility: hidden;
      width: 0;
    }
  }
  @container (width > ${EXTRA_LARGE_BREAKPOINT}) {
    /* Sized against the tree, not the row: a row's content box shrinks as
       nesting indents it, so a percentage would start each bar at a
       different x. Container units keep every bar's left edge aligned. */
    --trace-tree-timing-width: 33cqi;
  }
`;

/**
 * A row of the tree. Its children anchor to the title line; a metrics footer
 * hangs below without moving them. Expects {@link nestingLevelStyle}.
 */
export const spanNodeWrapCSS = css`
  position: relative;
  width: 100%;
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  gap: var(--global-dimension-size-100);
  padding-right: var(--global-dimension-size-100);
  padding-top: var(--trace-tree-row-padding-y);
  padding-bottom: var(--trace-tree-row-padding-y);
  padding-left: calc(
    var(--trace-tree-nesting-level, 0) * var(--trace-tree-nesting-indent) +
      ${ROW_PADDING_X}px
  );
  border-left: ${SELECTION_BORDER_WIDTH}px solid transparent;
  box-sizing: border-box;
`;

/** A box the height of the title line with its content vertically centered. */
export const headingLineCSS = css`
  display: flex;
  align-items: center;
  height: var(--trace-tree-heading-height);
  flex: none;
`;

export const spanNodeIconCSS = css`
  ${headingLineCSS}
  /* Sit above the tree lines that end underneath it */
  position: relative;
  z-index: ${TREE_ICON_Z_INDEX};
`;

/** The title line and the metrics footer beneath it. */
export const spanNodeContentCSS = css`
  display: flex;
  flex-direction: column;
  gap: var(--global-dimension-size-50);
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
`;

export const spanTimingCSS = css`
  ${headingLineCSS}
  width: var(--trace-tree-timing-width);
  flex-direction: row;
`;

export const spanControlsCSS = css`
  ${headingLineCSS}
  width: 20px;
  justify-content: center;
`;

/*
 * The horizontal position of a line is computed where the line is drawn, not
 * on the list, so it picks up the nesting level of its own row or list item.
 */
const edgeLeft = `calc(
    var(--trace-tree-nesting-level, 0) * var(--trace-tree-nesting-indent) +
      var(--trace-tree-edge-offset)
  )`;

const treeLineCSS = css`
  position: absolute;
  /* Widths and heights below include the 1px line itself */
  box-sizing: border-box;
  border-width: 0;
  border-style: solid;
  border-color: var(--trace-tree-line-color);
  z-index: ${TREE_LINE_Z_INDEX};
  &[data-status-code="ERROR"] {
    --trace-tree-line-color: var(--global-color-danger);
    z-index: ${TREE_LINE_ERROR_Z_INDEX};
  }
`;

/**
 * The line in a list item that joins a row to the next sibling below it.
 * Positioned in list item coordinates at the parent's nesting level.
 */
export const spanTreeEdgeConnectorCSS = css`
  ${treeLineCSS}
  border-left-width: 1px;
  top: 0;
  bottom: 0;
  left: ${edgeLeft};
`;

/**
 * The elbow inside a row that joins it to its parent's line: from the top of
 * the row to the center of its icon. Offsets are in the row's padding box, so
 * the selection border is taken off and the parent's level is one shallower.
 */
export const spanTreeEdgeCSS = css`
  ${treeLineCSS}
  border-left-width: 1px;
  border-bottom-width: 1px;
  border-radius: 0 0 0 ${ELBOW_SIZE}px;
  top: 0;
  height: var(--trace-tree-icon-center);
  left: calc(
    ${edgeLeft} - var(--trace-tree-nesting-indent) - ${SELECTION_BORDER_WIDTH}px
  );
  width: ${ELBOW_SIZE}px;
`;

/**
 * The line inside a row that drops from one gap below its icon to the bottom
 * of the row, where the first child's elbow picks it up.
 */
export const spanTreeDropCSS = css`
  ${treeLineCSS}
  border-left-width: 1px;
  top: calc(
    var(--trace-tree-row-padding-y) + var(--trace-tree-heading-height) +
      ${LINE_GAP}px
  );
  bottom: 0;
  left: calc(${edgeLeft} - ${SELECTION_BORDER_WIDTH}px);
`;
