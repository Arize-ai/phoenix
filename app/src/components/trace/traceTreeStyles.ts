import { css } from "@emotion/react";

import {
  TRACE_TREE_HOVER_WIDTH_PIXELS,
  TRACE_TREE_TOOLBAR_STACK_WIDTH_PIXELS,
} from "@phoenix/constants";

export const NESTING_INDENT = 25;
export const COMPACT_BREAKPOINT = "300px";
export const LARGE_BREAKPOINT = "500px";
export const EXTRA_LARGE_BREAKPOINT = "800px";

/**
 * Content for the resizable trace-tree column. The parent Panel is the query
 * container. When the allocated column is narrower than size-3000, hovering
 * or moving keyboard focus into the tree exposes a usable overlay without
 * changing the resizable layout's remembered width.
 */
export const traceTreePanelContentCSS = css`
  position: relative;
  z-index: 1;
  box-sizing: border-box;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  container-type: inline-size;
  background: var(--global-background-color-default);

  @container trace-tree-panel (width < ${TRACE_TREE_HOVER_WIDTH_PIXELS}px) {
    &:hover,
    &:focus-within {
      z-index: 2;
      width: var(--global-dimension-size-3000);
      border-right: var(--global-border-size-thin) solid
        var(--global-border-color-default);
      box-shadow: 4px 0 12px rgba(var(--global-color-gray-900-rgb), 0.12);

      .trace-tree-toolbar__search {
        flex: 1 1 auto;
        width: 100%;
      }

      .trace-tree-toolbar__search .search-field {
        width: 100%;
      }

      .trace-tree-toolbar__search .react-aria-Input {
        width: 100%;
        padding-left: calc(
          var(--global-dimension-size-200) + var(--global-font-size-l)
        ) !important;
        padding-right: var(--global-dimension-size-300) !important;
        opacity: 1;
        cursor: text;
      }

      .trace-tree-toolbar__search .search-field__icon {
        left: var(--global-dimension-size-100);
        transform: translateY(-50%);
      }

      .trace-tree-toolbar__search .search-field__clear:not([data-empty]) {
        display: flex;
      }
    }
  }

  @container trace-tree-panel (width < ${TRACE_TREE_TOOLBAR_STACK_WIDTH_PIXELS}px) {
    &:hover,
    &:focus-within {
      .trace-tree-toolbar__controls {
        width: 100%;
      }

      .trace-tree-toolbar__action {
        justify-content: flex-start;
        width: 100%;
        padding: var(--global-dimension-size-50)
          var(--global-dimension-size-100) !important;
      }

      .trace-tree-toolbar__action-label {
        display: inline;
      }
    }
  }
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
    .span-tree-timing {
      width: 33%;
    }
  }
`;
