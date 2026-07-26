import { css } from "@emotion/react";
import type { SerializedStyles } from "@emotion/react";
import type {
  CSSProperties,
  PointerEvent as ReactPointerEvent,
  PropsWithChildren,
} from "react";
import { useEffect, useRef, useState } from "react";
import { Separator } from "react-resizable-panels";

import {
  compactResizeHandleCSS,
  diagnosticResizeHandleCSS,
} from "@phoenix/components/resize";

import { traceTreePanelContentCSS } from "./traceTreeStyles";

export const resizableTraceTreePanelStyle: CSSProperties = {
  maxWidth: "none",
  overflow: "visible",
  position: "relative",
  zIndex: "var(--global-z-index-local-overlay)",
};

const treeSeparatorCSS = css`
  ${compactResizeHandleCSS};
  ${diagnosticResizeHandleCSS};
  position: relative;
  z-index: var(--global-z-index-local-control);
`;

type ResizableTraceTreePanelContentProps = PropsWithChildren<{
  contentCSS?: SerializedStyles;
}>;

/**
 * Owns the narrow trace-tree content that temporarily overlays the main
 * details column when there is not enough room to render its controls.
 */
export function ResizableTraceTreePanelContent({
  children,
  contentCSS,
}: ResizableTraceTreePanelContentProps) {
  return (
    <div
      className="trace-tree-panel-content"
      data-testid="scrolling-panel-content"
      css={[traceTreePanelContentCSS, contentCSS]}
    >
      {children}
    </div>
  );
}

type ResizableTraceTreeSeparatorProps = {
  onResizeStart: (width: number) => void;
  onResize: (width: number) => number;
  onResizeEnd: (didMove: boolean) => void;
};

/**
 * The single separator for the trace-tree column. When narrow content expands
 * as an overlay, the separator follows its rendered edge. Starting a drag
 * promotes that overlay width to the real panel before resizing continues.
 */
export function ResizableTraceTreeSeparator({
  onResizeStart,
  onResize,
  onResizeEnd,
}: ResizableTraceTreeSeparatorProps) {
  const separatorRef = useRef<HTMLDivElement>(null);
  const [overlayOffset, setOverlayOffset] = useState(0);
  const [isOverlayResizing, setIsOverlayResizing] = useState(false);
  const startPointerXRef = useRef(0);
  const startWidthRef = useRef(0);
  const didMoveRef = useRef(false);

  useEffect(() => {
    const separator = separatorRef.current;
    const treePanel = separator?.previousElementSibling;
    const content = treePanel?.querySelector<HTMLElement>(
      ".trace-tree-panel-content"
    );
    if (!(treePanel instanceof HTMLElement) || !content) return undefined;

    const updateOverlayOffset = () => {
      const contentWidth = content.getBoundingClientRect().width;
      const panelWidth = treePanel.getBoundingClientRect().width;
      setOverlayOffset(Math.max(0, contentWidth - panelWidth));
    };
    const resizeObserver = new ResizeObserver(updateOverlayOffset);
    resizeObserver.observe(treePanel);
    resizeObserver.observe(content);
    updateOverlayOffset();

    return () => resizeObserver.disconnect();
  }, []);

  // react-resizable-panels listens at document capture. When the separator is
  // following an overlay, reserve pointer resizing for the promotion flow
  // below; at its normal position the library remains fully in control.
  useEffect(() => {
    if (overlayOffset === 0) return undefined;
    const preventNativeResize = (event: PointerEvent) => {
      const eventTarget = event.target;
      if (
        eventTarget instanceof Node &&
        separatorRef.current?.contains(eventTarget)
      ) {
        event.preventDefault();
      }
    };
    window.addEventListener("pointerdown", preventNativeResize, true);
    return () =>
      window.removeEventListener("pointerdown", preventNativeResize, true);
  }, [overlayOffset]);

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (overlayOffset === 0) return;
    const separator = event.currentTarget;
    const treePanel = separator.previousElementSibling;
    const content = treePanel?.querySelector<HTMLElement>(
      ".trace-tree-panel-content"
    );
    if (!content) return;

    separator.setPointerCapture(event.pointerId);
    const renderedWidth = content.getBoundingClientRect().width;
    startPointerXRef.current = event.clientX;
    startWidthRef.current = renderedWidth;
    didMoveRef.current = false;
    onResizeStart(renderedWidth);
    setOverlayOffset(0);
    setIsOverlayResizing(true);
    event.preventDefault();
    event.stopPropagation();
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    const pointerDelta = event.clientX - startPointerXRef.current;
    didMoveRef.current ||= pointerDelta !== 0;
    onResize(startWidthRef.current + pointerDelta);
  };

  const finishResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    event.currentTarget.releasePointerCapture(event.pointerId);
    setIsOverlayResizing(false);
    onResizeEnd(didMoveRef.current);
  };

  return (
    <Separator
      id="details-panel-tree-separator"
      elementRef={separatorRef}
      aria-label="Resize trace tree"
      className="details-panel-tree-separator"
      data-overlay-resizing={isOverlayResizing || undefined}
      css={treeSeparatorCSS}
      style={{
        transform:
          overlayOffset > 0 ? `translateX(${overlayOffset}px)` : undefined,
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={finishResize}
      onPointerCancel={finishResize}
    />
  );
}
