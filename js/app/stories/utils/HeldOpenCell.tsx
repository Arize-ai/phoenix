import { css } from "@emotion/react";
import type { CSSProperties, ReactNode } from "react";
import { useState } from "react";
import { UNSAFE_PortalProvider } from "react-aria/PortalProvider";

const BOUNDARY_EXTENT = 100_000;

let boundary: HTMLElement | null = null;

const cellCSS = css`
  position: relative;

  .react-aria-Popover,
  .react-aria-Popover[data-entering] {
    animation: none;
    transition: none;
    transform: none;
    opacity: 1;
  }
`;

/**
 * An element far larger than any page, centered on the document origin and
 * clipped to nothing so it never adds scroll or paint.
 */
function getBoundary() {
  if (!boundary) {
    const clip = document.createElement("div");
    clip.style.cssText =
      "position:absolute;top:0;left:0;width:0;height:0;overflow:hidden;pointer-events:none";
    boundary = document.createElement("div");
    boundary.style.cssText = `position:absolute;top:${-BOUNDARY_EXTENT / 2}px;left:${-BOUNDARY_EXTENT / 2}px;width:${BOUNDARY_EXTENT}px;height:${BOUNDARY_EXTENT}px`;
    clip.appendChild(boundary);
    document.body.appendChild(clip);
  }
  return boundary;
}

/**
 * A cell that holds one popover-based layer open for a story: a menu, a
 * popover or a select's listbox, shown for its content rather than its
 * launch.
 *
 * The layer is portaled into the cell, so it takes the cell's theme in
 * `Both` mode and keeps its place as a Docs page lays out around it. Pass
 * the `boundaryElement` that `children` receives to the layer's popover.
 * React Aria positions a popover once, when it opens, measuring the room
 * around its trigger against the viewport by default, and does not
 * reposition it as the page scrolls or grows. A layer mounted below the fold
 * of a long Docs page, or before the stories above it have rendered, would
 * flip above its trigger or lose its height. Against a boundary larger than
 * any page, the layer always opens at its own placement, wherever the page
 * is scrolled and however tall it is. It appears without the popover's
 * opening animation, which would otherwise replay on every mount. The cell
 * reserves the layer's room, since an open popover takes no layout space.
 *
 * Pass the layer's trigger `isOpen` and an `onOpenChange` that ignores
 * closing, so no press or key dismisses it.
 */
export function HeldOpenCell({
  width,
  height,
  style,
  children,
}: {
  width: number;
  height: number;
  style?: CSSProperties;
  children: (boundaryElement: Element) => ReactNode;
}) {
  const [cell, setCell] = useState<HTMLDivElement | null>(null);
  return (
    <div
      ref={setCell}
      data-held-open-cell=""
      css={cellCSS}
      style={{ ...style, width, height }}
    >
      {cell && (
        <UNSAFE_PortalProvider getContainer={() => cell}>
          {children(getBoundary())}
        </UNSAFE_PortalProvider>
      )}
    </div>
  );
}
