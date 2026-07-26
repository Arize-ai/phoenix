import { css } from "@emotion/react";
import type { SerializedStyles } from "@emotion/react";
import type { CSSProperties, PropsWithChildren } from "react";
import { useEffect, useEffectEvent, useRef, useState } from "react";
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
  const overlayOffsetRef = useRef(0);
  const activePointerIdRef = useRef<number | null>(null);
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
      // A native drag may cross the narrow-mode breakpoint while the pointer
      // is still captured at the allocated edge. Never move the separator out
      // from under that drag.
      if (
        separator.dataset.separator === "active" ||
        activePointerIdRef.current !== null
      ) {
        overlayOffsetRef.current = 0;
        setOverlayOffset(0);
        return;
      }
      const contentWidth = content.getBoundingClientRect().width;
      const panelWidth = treePanel.getBoundingClientRect().width;
      const nextOverlayOffset = Math.max(0, contentWidth - panelWidth);
      overlayOffsetRef.current = nextOverlayOffset;
      setOverlayOffset(nextOverlayOffset);
    };
    const resizeObserver = new ResizeObserver(updateOverlayOffset);
    resizeObserver.observe(treePanel);
    resizeObserver.observe(content);
    updateOverlayOffset();

    return () => resizeObserver.disconnect();
  }, []);

  const handleWindowPointerDown = useEffectEvent((event: PointerEvent) => {
    const separator = separatorRef.current;
    const eventTarget = event.target;
    if (
      overlayOffsetRef.current === 0 ||
      !(eventTarget instanceof Node) ||
      !separator?.contains(eventTarget)
    ) {
      return;
    }

    const treePanel = separator.previousElementSibling;
    const content = treePanel?.querySelector<HTMLElement>(
      ".trace-tree-panel-content"
    );
    if (!content) return;

    // react-resizable-panels begins resizing from a document capture listener.
    // Intercept only the translated overlay separator at window capture so its
    // old, narrow layout is not captured as a second competing drag session.
    event.preventDefault();
    event.stopPropagation();
    separator.setPointerCapture(event.pointerId);
    const renderedWidth = content.getBoundingClientRect().width;
    activePointerIdRef.current = event.pointerId;
    startPointerXRef.current = event.clientX;
    startWidthRef.current = renderedWidth;
    didMoveRef.current = false;
    onResizeStart(renderedWidth);
    overlayOffsetRef.current = 0;
    setOverlayOffset(0);
    setIsOverlayResizing(true);
  });

  const handleWindowPointerMove = useEffectEvent((event: PointerEvent) => {
    if (activePointerIdRef.current !== event.pointerId) return;
    const pointerDelta = event.clientX - startPointerXRef.current;
    didMoveRef.current ||= pointerDelta !== 0;
    onResize(startWidthRef.current + pointerDelta);
  });

  const finishWindowResize = useEffectEvent((event: PointerEvent) => {
    if (activePointerIdRef.current !== event.pointerId) return;
    const separator = separatorRef.current;
    if (separator?.hasPointerCapture(event.pointerId)) {
      separator.releasePointerCapture(event.pointerId);
    }
    activePointerIdRef.current = null;
    setIsOverlayResizing(false);
    onResizeEnd(didMoveRef.current);
  });

  // The window capture listener runs before react-resizable-panels' document
  // capture listener and reserves only drags that begin at the overlay edge.
  useEffect(() => {
    window.addEventListener("pointerdown", handleWindowPointerDown, true);
    window.addEventListener("pointermove", handleWindowPointerMove, true);
    window.addEventListener("pointerup", finishWindowResize, true);
    window.addEventListener("pointercancel", finishWindowResize, true);
    return () => {
      window.removeEventListener("pointerdown", handleWindowPointerDown, true);
      window.removeEventListener("pointermove", handleWindowPointerMove, true);
      window.removeEventListener("pointerup", finishWindowResize, true);
      window.removeEventListener("pointercancel", finishWindowResize, true);
    };
  }, []);

  return (
    <Separator
      id="details-panel-tree-separator"
      elementRef={separatorRef}
      aria-label="Resize trace tree"
      className="details-panel-tree-separator"
      data-overlay-active={overlayOffset > 0 || undefined}
      data-overlay-resizing={isOverlayResizing || undefined}
      css={treeSeparatorCSS}
      style={{
        transform:
          overlayOffset > 0 ? `translateX(${overlayOffset}px)` : undefined,
      }}
    />
  );
}
