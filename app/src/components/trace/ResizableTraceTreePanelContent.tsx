import { css } from "@emotion/react";
import type { SerializedStyles } from "@emotion/react";
import type { CSSProperties, KeyboardEvent, PropsWithChildren } from "react";
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
 * Owns the trace-tree column content.
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
  ariaLabel?: string;
  isCompact?: boolean;
  isDisabled?: boolean;
  onResizeStart: (width: number) => void;
  onResize: (width: number) => number;
  onResizeEnd: (options: { didMove: boolean; shouldCommit: boolean }) => void;
  onToggle?: () => void;
};

/**
 * The single pointer-gesture owner for the trace-tree column. It intercepts
 * before react-resizable-panels' document-capture listener so a drag can move
 * from shrinking the main column to growing the enclosing drawer without a
 * second owner taking over. The library owns expanded keyboard resizing;
 * compact arrow-key resizing follows the drawer-proxy interaction below.
 *
 * Expanded resize requests are clamped at the useful open minimum by the
 * sizing machine. In compact mode, the sizing adapter keeps the tree rail
 * fixed and maps the same gesture to the enclosing drawer instead.
 */
export function ResizableTraceTreeSeparator({
  ariaLabel = "Resize trace tree",
  isCompact = false,
  isDisabled = false,
  onResizeStart,
  onResize,
  onResizeEnd,
  onToggle,
}: ResizableTraceTreeSeparatorProps) {
  const separatorRef = useRef<HTMLDivElement>(null);
  const [isPointerResizing, setIsPointerResizing] = useState(false);
  const activePointerIdRef = useRef<number | null>(null);
  const startPointerXRef = useRef(0);
  const startWidthRef = useRef(0);
  const didMoveRef = useRef(false);

  const handleKeyDownCapture = (event: KeyboardEvent<HTMLDivElement>) => {
    if (
      isDisabled ||
      !isCompact ||
      (event.key !== "ArrowLeft" && event.key !== "ArrowRight")
    ) {
      return;
    }
    const separator = separatorRef.current;
    const treePanel = separator?.previousElementSibling;
    if (!(treePanel instanceof HTMLElement)) return;

    // Intercept before the library's target listener, whose normal behavior
    // cannot move a panel constrained to the compact rail's exact width.
    event.preventDefault();
    event.stopPropagation();
    const renderedWidth = treePanel.getBoundingClientRect().width;
    const keyboardDelta = window.innerWidth * 0.05;
    onResizeStart(renderedWidth);
    onResize(
      renderedWidth +
        (event.key === "ArrowLeft" ? -keyboardDelta : keyboardDelta)
    );
    onResizeEnd({ didMove: true, shouldCommit: true });
  };

  const handleWindowPointerDown = useEffectEvent((event: PointerEvent) => {
    const separator = separatorRef.current;
    const eventTarget = event.target;
    if (
      isDisabled ||
      !event.isPrimary ||
      (event.pointerType === "mouse" && event.button !== 0) ||
      !(eventTarget instanceof Node) ||
      !separator?.contains(eventTarget)
    ) {
      return;
    }

    const treePanel = separator.previousElementSibling;
    if (!(treePanel instanceof HTMLElement)) return;

    // react-resizable-panels begins resizing from a document capture listener;
    // reserve this pointer at window capture so only this state machine can
    // resize the panels during the gesture.
    event.preventDefault();
    event.stopPropagation();
    separator.focus({ preventScroll: true });
    separator.setPointerCapture(event.pointerId);
    const renderedWidth = treePanel.getBoundingClientRect().width;
    activePointerIdRef.current = event.pointerId;
    startPointerXRef.current = event.clientX;
    startWidthRef.current = renderedWidth;
    didMoveRef.current = false;
    onResizeStart(renderedWidth);
    setIsPointerResizing(true);
  });

  const handleWindowPointerMove = useEffectEvent((event: PointerEvent) => {
    if (activePointerIdRef.current !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    const pointerDelta = event.clientX - startPointerXRef.current;
    didMoveRef.current ||= pointerDelta !== 0;
    onResize(startWidthRef.current + pointerDelta);
  });

  const finishWindowResize = useEffectEvent(
    ({
      event,
      shouldCommit,
    }: {
      event: PointerEvent;
      shouldCommit: boolean;
    }) => {
      if (activePointerIdRef.current !== event.pointerId) return;
      event.preventDefault();
      event.stopPropagation();
      const separator = separatorRef.current;
      if (separator?.hasPointerCapture(event.pointerId)) {
        separator.releasePointerCapture(event.pointerId);
      }
      activePointerIdRef.current = null;
      setIsPointerResizing(false);
      onResizeEnd({ didMove: didMoveRef.current, shouldCommit });
    }
  );

  const handleWindowPointerUp = useEffectEvent((event: PointerEvent) => {
    finishWindowResize({ event, shouldCommit: true });
  });

  const handleWindowPointerCancel = useEffectEvent((event: PointerEvent) => {
    finishWindowResize({ event, shouldCommit: false });
  });

  // The window capture listener runs before react-resizable-panels' document
  // capture listener and reserves the tree separator gesture.
  useEffect(() => {
    window.addEventListener("pointerdown", handleWindowPointerDown, true);
    window.addEventListener("pointermove", handleWindowPointerMove, true);
    window.addEventListener("pointerup", handleWindowPointerUp, true);
    window.addEventListener("pointercancel", handleWindowPointerCancel, true);
    return () => {
      window.removeEventListener("pointerdown", handleWindowPointerDown, true);
      window.removeEventListener("pointermove", handleWindowPointerMove, true);
      window.removeEventListener("pointerup", handleWindowPointerUp, true);
      window.removeEventListener(
        "pointercancel",
        handleWindowPointerCancel,
        true
      );
    };
  }, []);

  return (
    <Separator
      id="details-panel-tree-separator"
      elementRef={separatorRef}
      aria-label={ariaLabel}
      disabled={isDisabled}
      disableDoubleClick={onToggle != null}
      className="details-panel-tree-separator"
      data-dragging={isPointerResizing ? "true" : undefined}
      onDoubleClick={onToggle}
      onKeyDownCapture={handleKeyDownCapture}
      css={treeSeparatorCSS}
    />
  );
}
