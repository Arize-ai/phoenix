import { css } from "@emotion/react";

export const TRACE_TREE_CHILD_NESTING_INDENT_PIXELS = 25;
export const TRACE_TREE_COMPACT_LAYOUT_BREAKPOINT = "300px";
export const TRACE_TREE_ROW_SELECTION_BORDER_WIDTH = "3px";

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

  &[data-navigation-scrollbar="active"],
  &:has([data-navigation-scrollbar="active"]) {
    [data-trace-tree-root],
    [data-testid="trace-tree-skeleton"],
    .session-turn-list,
    [data-testid="session-trace-row-list"] {
      scrollbar-color: var(--global-color-gray-300) transparent;
      scrollbar-gutter: stable;
    }

    [data-trace-tree-root]::-webkit-scrollbar-track,
    [data-testid="trace-tree-skeleton"]::-webkit-scrollbar-track,
    .session-turn-list::-webkit-scrollbar-track,
    [data-testid="session-trace-row-list"]::-webkit-scrollbar-track {
      background: transparent;
    }
  }
`;

export const traceTreeListCSS = css`
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  width: 100%;
  --trace-tree-child-nesting-indent: ${TRACE_TREE_CHILD_NESTING_INDENT_PIXELS}px;
  @container (width < ${TRACE_TREE_COMPACT_LAYOUT_BREAKPOINT}) {
    --trace-tree-child-nesting-indent: var(--global-dimension-size-0);
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
