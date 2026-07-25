import { css } from "@emotion/react";
import type { SerializedStyles } from "@emotion/react";
import type {
  CSSProperties,
  PointerEvent as ReactPointerEvent,
  PropsWithChildren,
} from "react";
import { useRef, useState } from "react";

import { traceTreePanelContentCSS } from "./traceTreeStyles";

export const resizableTraceTreePanelStyle: CSSProperties = {
  maxWidth: "none",
  overflow: "visible",
  position: "relative",
  zIndex: 4,
};

const overlayResizeHandleCSS = css`
  display: none;
  position: absolute;
  z-index: 3;
  top: 0;
  right: 0;
  bottom: 0;
  width: var(--global-dimension-size-100);
  padding: 0;
  border: 0;
  outline: none;
  background: transparent;
  cursor: ew-resize;
  touch-action: none;
  transform: translateX(50%);

  &::after {
    content: "";
    position: absolute;
    top: 0;
    bottom: 0;
    left: 50%;
    width: var(--global-border-size-thin);
    background: var(--global-resize-handle-background-color);
    transform: translateX(-50%);
  }

  &:hover::after,
  &[data-dragging="true"]::after {
    background: var(--global-resize-handle-indicator-color-hover);
  }
`;

type ResizableTraceTreePanelContentProps = PropsWithChildren<{
  contentCSS?: SerializedStyles;
  onResizeStart: (width: number) => void;
  onResize: (width: number) => number;
  onResizeEnd: () => void;
}>;

/**
 * Owns the narrow trace-tree overlay and the resize edge that promotes the
 * temporary overlay width to the user's persisted column width.
 */
export function ResizableTraceTreePanelContent({
  children,
  contentCSS,
  onResizeStart,
  onResize,
  onResizeEnd,
}: ResizableTraceTreePanelContentProps) {
  const [isOverlayResizing, setIsOverlayResizing] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const startPointerXRef = useRef(0);
  const startWidthRef = useRef(0);

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    const contentRect = contentRef.current?.getBoundingClientRect();
    const handleRect = event.currentTarget.getBoundingClientRect();
    const handleCenterX = handleRect.left + handleRect.width / 2;
    const renderedWidth = contentRect
      ? handleCenterX - contentRect.left
      : handleRect.width;
    startPointerXRef.current = event.clientX;
    startWidthRef.current = renderedWidth;
    onResizeStart(renderedWidth);
    setIsOverlayResizing(true);
    event.preventDefault();
    event.stopPropagation();
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    const pointerDelta = event.clientX - startPointerXRef.current;
    onResize(startWidthRef.current + pointerDelta);
  };

  const finishResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    event.currentTarget.releasePointerCapture(event.pointerId);
    setIsOverlayResizing(false);
    onResizeEnd();
  };

  return (
    <div
      className="trace-tree-panel-content"
      data-testid="scrolling-panel-content"
      data-overlay-resizing={isOverlayResizing || undefined}
      css={[traceTreePanelContentCSS, contentCSS]}
      ref={contentRef}
    >
      {children}
      <div
        className="trace-tree-panel-content__resize-handle"
        role="separator"
        aria-label="Resize trace tree"
        aria-orientation="vertical"
        tabIndex={-1}
        data-dragging={isOverlayResizing || undefined}
        css={overlayResizeHandleCSS}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishResize}
        onPointerCancel={finishResize}
      />
    </div>
  );
}
