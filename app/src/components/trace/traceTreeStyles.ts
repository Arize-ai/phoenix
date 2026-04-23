import { css } from "@emotion/react";

export const NESTING_INDENT = 25;
export const COMPACT_BREAKPOINT = "300px";
export const LARGE_BREAKPOINT = "500px";
export const EXTRA_LARGE_BREAKPOINT = "800px";

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
      padding-left: var(--global-dimension-static-size-200);
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
