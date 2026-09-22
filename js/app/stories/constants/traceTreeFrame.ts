import type { CSSProperties } from "react";

/**
 * The frame the trace tree stories and the skeleton stories render into, so
 * a skeleton story looks like the tree it stands in for.
 */
export const traceTreeFrameStyle: CSSProperties = {
  height: 480,
  border: "1px solid var(--global-border-color-default)",
  background: "var(--global-color-gray-75)",
  display: "flex",
  flexDirection: "column",
};
