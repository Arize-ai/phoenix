import { css } from "@emotion/react";

import { TRACE_TREE_MIN_WIDTH_PIXELS } from "@phoenix/constants";

export const TRACE_TREE_CHILD_NESTING_INDENT_PIXELS = 25;
export const TRACE_TREE_COMPACT_LAYOUT_BREAKPOINT = `${TRACE_TREE_MIN_WIDTH_PIXELS}px`;
export const TRACE_TREE_ROW_SELECTION_BORDER_WIDTH = "3px";

/**
 * Extends a navigation row's state background beneath the scrollbar gutter.
 * The scrolling ancestor clips the oversized paint at its own edge, so this
 * does not depend on a browser- or operating-system-specific scrollbar width.
 */
export const detailsPanelNavigationRowBackgroundBleedCSS = css`
  --details-panel-navigation-row-bleed-background-color: transparent;
  --details-panel-navigation-row-bleed-border-bottom-width: 0px;
  --details-panel-navigation-row-bleed-border-bottom-color: transparent;
  position: relative;

  &::after {
    box-sizing: border-box;
    position: absolute;
    inset-block: 0;
    inset-inline-start: 100%;
    width: 100vw;
    border-bottom: var(--details-panel-navigation-row-bleed-border-bottom-width)
      solid var(--details-panel-navigation-row-bleed-border-bottom-color);
    background-color: var(
      --details-panel-navigation-row-bleed-background-color
    );
    content: "";
    pointer-events: none;
  }
`;

/**
 * Paints row backgrounds and a matching thumb over the native scrollbar.
 */
export const detailsPanelNavigationScrollOwnerCSS = css`
  position: relative;

  &::after {
    position: fixed;
    top: var(--details-panel-navigation-scroll-owner-top, 0px);
    left: var(--details-panel-navigation-scroll-owner-left, 0px);
    z-index: var(--global-z-index-local-overlay);
    width: var(--details-panel-navigation-scroll-owner-gutter-width, 0px);
    height: var(--details-panel-navigation-scroll-owner-height, 0px);
    background:
      var(--details-panel-navigation-scroll-owner-background, transparent),
      var(--global-background-color-default);
    content: "";
    pointer-events: none;
  }

  &::before {
    position: fixed;
    top: var(--details-panel-navigation-scrollbar-thumb-top, 0px);
    left: var(--details-panel-navigation-scrollbar-thumb-left, 0px);
    z-index: calc(var(--global-z-index-local-overlay) + 1);
    width: var(--details-panel-navigation-scrollbar-thumb-width, 0px);
    height: var(--details-panel-navigation-scrollbar-thumb-height, 0px);
    border-radius: var(--global-rounding-full);
    background: var(--global-color-gray-300);
    content: "";
    pointer-events: none;
  }
`;

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
    [data-trace-tree-root][data-navigation-scroll-owner="true"],
    [data-testid="trace-tree-skeleton"][data-navigation-scroll-owner="true"],
    .session-turn-list,
    [data-testid="session-trace-row-list"] {
      scrollbar-color: var(--global-color-gray-300) transparent;
      scrollbar-gutter: stable;
    }

    [data-trace-tree-root][data-navigation-scroll-owner="true"]::-webkit-scrollbar-track,
    [data-testid="trace-tree-skeleton"][data-navigation-scroll-owner="true"]::-webkit-scrollbar-track,
    .session-turn-list::-webkit-scrollbar-track,
    [data-testid="session-trace-row-list"]::-webkit-scrollbar-track {
      background: transparent;
    }
  }
`;

export const traceTreeListCSS = css`
  ${detailsPanelNavigationScrollOwnerCSS}
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
