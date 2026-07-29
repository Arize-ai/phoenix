import { css } from "@emotion/react";

export const NESTING_INDENT = 25;
export const COMPACT_BREAKPOINT = "300px";
export const TRACE_TREE_ROW_INLINE_START = "var(--global-dimension-size-125)";
export const TRACE_TREE_ROW_BORDER_WIDTH = "3px";

/**
 * Content for the resizable trace-tree column. The sizing machine guarantees
 * that this content is either usefully open or reduced to the compact rail.
 */
export const traceTreePanelContentCSS = css`
  position: relative;
  z-index: var(--global-z-index-local-base);
  box-sizing: border-box;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  container-type: inline-size;
  background: var(--global-background-color-default);
  --trace-tree-overflow-y: auto;
`;

export const traceTreeListCSS = css`
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  width: 100%;
  --trace-tree-nesting-indent: ${NESTING_INDENT}px;
  @container (width < ${COMPACT_BREAKPOINT}) {
    --trace-tree-nesting-indent: 0;
    .span-controls,
    .latency-text,
    .token-count-item,
    .span-tree-edge-connector,
    .span-tree-edge,
    .span-tree-timing {
      display: none;
      visibility: hidden;
      width: 0;
    }
  }
`;
