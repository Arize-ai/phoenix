import {
  spanTreeDropCSS,
  spanTreeEdgeConnectorCSS,
  spanTreeEdgeCSS,
} from "./traceTreeStyles";
import type { SpanStatusCodeType } from "./types";

type TreeLineProps = {
  /**
   * Status of the span the line leads to. Error lines are drawn in the danger
   * color above the others.
   * @default "UNSET"
   */
  statusCode?: SpanStatusCodeType;
};

/**
 * The line that joins a row to the next sibling below it. Render it in the
 * list item, which carries the parent's nesting level.
 */
export function SpanTreeEdgeConnector({ statusCode = "UNSET" }: TreeLineProps) {
  return (
    <div
      aria-hidden="true"
      data-testid="span-tree-edge-connector"
      className="span-tree-edge-connector"
      data-status-code={statusCode}
      css={spanTreeEdgeConnectorCSS}
    />
  );
}

/**
 * The elbow that joins a row to the line dropped from its parent. Render it
 * inside the row so it ends at the row's own icon.
 */
export function SpanTreeEdge({ statusCode = "UNSET" }: TreeLineProps) {
  return (
    <div
      aria-hidden="true"
      className="span-tree-edge"
      data-status-code={statusCode}
      css={spanTreeEdgeCSS}
    />
  );
}

/**
 * The line that drops from a row's icon to the bottom of the row, where the
 * first child's elbow picks it up. Render it inside a row with visible children.
 */
export function SpanTreeDrop({ statusCode = "UNSET" }: TreeLineProps) {
  return (
    <div
      aria-hidden="true"
      className="span-tree-drop"
      data-status-code={statusCode}
      css={spanTreeDropCSS}
    />
  );
}
