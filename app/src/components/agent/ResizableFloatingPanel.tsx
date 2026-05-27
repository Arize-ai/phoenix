import { css } from "@emotion/react";
import type {
  CSSProperties,
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
  ReactNode,
  SyntheticEvent as ReactSyntheticEvent,
} from "react";
import { useEffect, useId, useRef, useState } from "react";

import {
  MODAL_FLOATING_UI_Z_INDEX,
  NON_MODAL_FLOATING_Z_INDEX,
} from "@phoenix/components/core/zIndex";
import type { AgentFabPlacement } from "@phoenix/store/agentStore";
import type { Point, Size } from "@phoenix/types/geometry";
import { clampNumber } from "@phoenix/utils/numberUtils";

import { useModalFloatingLayerInteractivity } from "./useModalFloatingLayerInteractivity";

const FULLSCREEN_BREAKPOINT_PX = 600;
const KEYBOARD_RESIZE_STEP_PX = 24;
const PRIMARY_POINTER_BUTTON = 0;
const RESIZE_HANDLE_SIZE_PX = 6;
const RESIZE_HANDLE_Z_INDEX = 4;

type FloatingPanelLayer = "content" | "modal";

type ResizeAxis = "horizontal" | "vertical";

type ResizeEdge = "bottom" | "left" | "right" | "top";

type ResizeHandleConfig = {
  axis: ResizeAxis;
  edge: ResizeEdge;
};

type ResizeLimits = {
  maxHeight: number;
  maxWidth: number;
  minHeight: number;
  minWidth: number;
};

type ResizeSession = {
  axis: ResizeAxis;
  edge: ResizeEdge;
  limits: ResizeLimits;
  pointerId: number;
  startPointer: Point;
  startSize: Size;
};

export type ResizableFloatingPanelProps = {
  children: ReactNode;
  layer?: FloatingPanelLayer;
  minSize: Size;
  placement: AgentFabPlacement;
  size: Size;
  onSizeChange?: (size: Size) => void;
};

function getResizeHandles(placement: AgentFabPlacement): ResizeHandleConfig[] {
  return [
    {
      axis: "horizontal",
      edge: placement.endsWith("end") ? "left" : "right",
    },
    {
      axis: "vertical",
      edge: placement.startsWith("bottom") ? "top" : "bottom",
    },
  ];
}

function getFallbackResizeLimits(minSize: Size): ResizeLimits {
  const maxHeight =
    typeof window === "undefined" ? minSize.height : window.innerHeight;
  const maxWidth =
    typeof window === "undefined" ? minSize.width : window.innerWidth;

  return {
    maxHeight,
    maxWidth,
    minHeight: Math.min(minSize.height, maxHeight),
    minWidth: Math.min(minSize.width, maxWidth),
  };
}

function getViewportRect(): DOMRect {
  return new DOMRect(0, 0, window.innerWidth, window.innerHeight);
}

function getPanelBoundaryRect(
  panel: HTMLElement,
  layer: FloatingPanelLayer
): DOMRect {
  if (layer === "modal") {
    return getViewportRect();
  }

  const boundary = panel.offsetParent ?? panel.parentElement;
  return boundary instanceof HTMLElement
    ? boundary.getBoundingClientRect()
    : getViewportRect();
}

function getResizeLimits({
  minSize,
  panel,
  layer,
  placement,
}: {
  minSize: Size;
  panel: HTMLElement | null;
  layer: FloatingPanelLayer;
  placement: AgentFabPlacement;
}): ResizeLimits {
  if (!panel) {
    return getFallbackResizeLimits(minSize);
  }

  const panelRect = panel.getBoundingClientRect();
  const boundaryRect = getPanelBoundaryRect(panel, layer);
  const horizontalInset = placement.endsWith("end")
    ? Math.max(boundaryRect.right - panelRect.right, 0)
    : Math.max(panelRect.left - boundaryRect.left, 0);
  const verticalInset = placement.startsWith("bottom")
    ? Math.max(boundaryRect.bottom - panelRect.bottom, 0)
    : Math.max(panelRect.top - boundaryRect.top, 0);
  const maxWidth = Math.max(
    placement.endsWith("end")
      ? panelRect.right - boundaryRect.left - horizontalInset
      : boundaryRect.right - panelRect.left - horizontalInset,
    0
  );
  const maxHeight = Math.max(
    placement.startsWith("bottom")
      ? panelRect.bottom - boundaryRect.top - verticalInset
      : boundaryRect.bottom - panelRect.top - verticalInset,
    0
  );

  return {
    maxHeight,
    maxWidth,
    minHeight: Math.min(minSize.height, maxHeight),
    minWidth: Math.min(minSize.width, maxWidth),
  };
}

function getPanelSizeFromElement({
  element,
  fallback,
}: {
  element: HTMLElement | null;
  fallback: Size;
}): Size {
  const rect = element?.getBoundingClientRect();
  if (rect && rect.width > 0 && rect.height > 0) {
    return {
      width: rect.width,
      height: rect.height,
    };
  }
  return fallback;
}

function getResizedPanelSize({
  pointer,
  session,
}: {
  pointer: Point;
  session: ResizeSession;
}): Size {
  const nextSize = { ...session.startSize };

  if (session.axis === "horizontal") {
    const delta =
      session.edge === "left"
        ? session.startPointer.x - pointer.x
        : pointer.x - session.startPointer.x;
    nextSize.width = clampNumber({
      value: session.startSize.width + delta,
      min: session.limits.minWidth,
      max: session.limits.maxWidth,
    });
  } else {
    const delta =
      session.edge === "top"
        ? session.startPointer.y - pointer.y
        : pointer.y - session.startPointer.y;
    nextSize.height = clampNumber({
      value: session.startSize.height + delta,
      min: session.limits.minHeight,
      max: session.limits.maxHeight,
    });
  }

  return nextSize;
}

function getKeyboardResizeDelta({
  axis,
  edge,
  key,
}: {
  axis: ResizeAxis;
  edge: ResizeEdge;
  key: string;
}): number | null {
  if (axis === "horizontal") {
    switch (key) {
      case "ArrowLeft":
        return edge === "left"
          ? KEYBOARD_RESIZE_STEP_PX
          : -KEYBOARD_RESIZE_STEP_PX;
      case "ArrowRight":
        return edge === "right"
          ? KEYBOARD_RESIZE_STEP_PX
          : -KEYBOARD_RESIZE_STEP_PX;
      default:
        return null;
    }
  }

  switch (key) {
    case "ArrowDown":
      return edge === "bottom"
        ? KEYBOARD_RESIZE_STEP_PX
        : -KEYBOARD_RESIZE_STEP_PX;
    case "ArrowUp":
      return edge === "top"
        ? KEYBOARD_RESIZE_STEP_PX
        : -KEYBOARD_RESIZE_STEP_PX;
    default:
      return null;
  }
}

const resizableFloatingPanelCSS = css`
  --resizable-floating-panel-viewport-margin: var(
    --global-dimension-size-400
  );

  position: absolute;
  z-index: ${NON_MODAL_FLOATING_Z_INDEX};
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  width: var(--resizable-floating-panel-width);
  height: var(--resizable-floating-panel-height);
  max-width: calc(100% - var(--resizable-floating-panel-viewport-margin));
  max-height: calc(100% - var(--resizable-floating-panel-viewport-margin));
  min-width: min(
    var(--resizable-floating-panel-min-width),
    calc(100% - var(--resizable-floating-panel-viewport-margin))
  );
  min-height: min(
    var(--resizable-floating-panel-min-height),
    calc(100% - var(--resizable-floating-panel-viewport-margin))
  );
  overflow: hidden;
  border: 1px solid var(--global-border-color-default);
  border-radius: var(--global-rounding-medium);
  background: var(--global-background-color-default);
  box-shadow:
    0 12px 32px rgba(var(--global-color-gray-900-rgb), 0.2),
    0 2px 8px rgba(var(--global-color-gray-900-rgb), 0.12);

  &[data-resizing="true"] {
    user-select: none;
  }

  &[data-layer="modal"] {
    position: fixed;
    z-index: ${MODAL_FLOATING_UI_Z_INDEX};
  }

  &[data-placement^="top"] {
    top: var(--global-dimension-size-200);
  }

  &[data-placement^="bottom"] {
    bottom: var(--global-dimension-size-200);
  }

  &[data-placement$="start"] {
    left: var(--global-dimension-size-200);
  }

  &[data-placement$="end"] {
    right: var(--global-dimension-size-200);
  }

  .resizable-floating-panel__resize-handle {
    position: absolute;
    z-index: ${RESIZE_HANDLE_Z_INDEX};
    border: none;
    outline: none;
    padding: 0;
    background: transparent;
    touch-action: none;
  }

  .resizable-floating-panel__resize-handle::after {
    content: "";
    position: absolute;
    background-color: transparent;
    transition: background-color 150ms ease-out;
  }

  .resizable-floating-panel__resize-handle:hover::after,
  .resizable-floating-panel__resize-handle[data-resizing="true"]::after,
  .resizable-floating-panel__resize-handle:focus-visible::after {
    background-color: var(--global-resize-handle-indicator-color-hover);
  }

  .resizable-floating-panel__resize-handle:focus-visible {
    outline: 2px solid var(--global-color-primary);
    outline-offset: -2px;
  }

  .resizable-floating-panel__resize-handle[data-edge="left"],
  .resizable-floating-panel__resize-handle[data-edge="right"] {
    top: 0;
    bottom: 0;
    width: ${RESIZE_HANDLE_SIZE_PX}px;
    cursor: ew-resize;
  }

  .resizable-floating-panel__resize-handle[data-edge="left"] {
    left: 0;
  }

  .resizable-floating-panel__resize-handle[data-edge="right"] {
    right: 0;
  }

  .resizable-floating-panel__resize-handle[data-edge="left"]::after,
  .resizable-floating-panel__resize-handle[data-edge="right"]::after {
    top: 0;
    bottom: 0;
    width: 2px;
  }

  .resizable-floating-panel__resize-handle[data-edge="left"]::after {
    left: 0;
  }

  .resizable-floating-panel__resize-handle[data-edge="right"]::after {
    right: 0;
  }

  .resizable-floating-panel__resize-handle[data-edge="top"],
  .resizable-floating-panel__resize-handle[data-edge="bottom"] {
    right: 0;
    left: 0;
    height: ${RESIZE_HANDLE_SIZE_PX}px;
    cursor: ns-resize;
  }

  .resizable-floating-panel__resize-handle[data-edge="top"] {
    top: 0;
  }

  .resizable-floating-panel__resize-handle[data-edge="bottom"] {
    bottom: 0;
  }

  .resizable-floating-panel__resize-handle[data-edge="top"]::after,
  .resizable-floating-panel__resize-handle[data-edge="bottom"]::after {
    right: 0;
    left: 0;
    height: 2px;
  }

  .resizable-floating-panel__resize-handle[data-edge="top"]::after {
    top: 0;
  }

  .resizable-floating-panel__resize-handle[data-edge="bottom"]::after {
    bottom: 0;
  }

  @media (max-width: ${FULLSCREEN_BREAKPOINT_PX}px), (max-height: ${FULLSCREEN_BREAKPOINT_PX}px) {
    inset: var(--global-dimension-size-100);
    width: auto;
    height: auto;
    max-width: none;
    max-height: none;
    min-height: 0;
    min-width: 0;

    .resizable-floating-panel__resize-handle {
      display: none;
    }
  }
`;

export function ResizableFloatingPanel({
  children,
  layer = "content",
  minSize,
  placement,
  size,
  onSizeChange,
}: ResizableFloatingPanelProps) {
  const panelId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const resizeSessionRef = useRef<ResizeSession | null>(null);
  const pendingSizeRef = useRef<Size | null>(null);
  const animationFrameIdRef = useRef<number | null>(null);
  const [resizingEdge, setResizingEdge] = useState<ResizeEdge | null>(null);
  useModalFloatingLayerInteractivity(panelRef, layer === "modal");

  const resizeLimits = getResizeLimits({
    layer,
    minSize,
    panel: panelRef.current,
    placement,
  });
  const resizeHandles = getResizeHandles(placement);
  const commitSize = (
    nextSize: Size,
    limits = getResizeLimits({
      layer,
      minSize,
      panel: panelRef.current,
      placement,
    })
  ) => {
    onSizeChange?.({
      height: clampNumber({
        value: nextSize.height,
        min: limits.minHeight,
        max: limits.maxHeight,
      }),
      width: clampNumber({
        value: nextSize.width,
        min: limits.minWidth,
        max: limits.maxWidth,
      }),
    });
  };
  const flushPendingSize = () => {
    animationFrameIdRef.current = null;
    if (pendingSizeRef.current == null) return;
    const nextSize = pendingSizeRef.current;
    pendingSizeRef.current = null;
    onSizeChange?.(nextSize);
  };
  const handleResizePointerDown = (
    event: ReactPointerEvent<HTMLDivElement>,
    { axis, edge }: ResizeHandleConfig
  ) => {
    if (event.button !== PRIMARY_POINTER_BUTTON) return;

    const panel = panelRef.current;
    if (!panel) return;

    event.currentTarget.setPointerCapture(event.pointerId);
    resizeSessionRef.current = {
      axis,
      edge,
      limits: getResizeLimits({ layer, minSize, panel, placement }),
      pointerId: event.pointerId,
      startPointer: { x: event.clientX, y: event.clientY },
      startSize: getPanelSizeFromElement({
        element: panel,
        fallback: size,
      }),
    };
    setResizingEdge(edge);
    event.preventDefault();
  };
  const handleResizePointerMove = (
    event: ReactPointerEvent<HTMLDivElement>
  ) => {
    const session = resizeSessionRef.current;
    if (!session) return;

    pendingSizeRef.current = getResizedPanelSize({
      pointer: { x: event.clientX, y: event.clientY },
      session,
    });
    event.preventDefault();

    if (animationFrameIdRef.current == null) {
      animationFrameIdRef.current =
        window.requestAnimationFrame(flushPendingSize);
    }
  };
  const finishResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    const session = resizeSessionRef.current;
    if (!session) return;

    if (animationFrameIdRef.current != null) {
      window.cancelAnimationFrame(animationFrameIdRef.current);
      animationFrameIdRef.current = null;
    }
    pendingSizeRef.current = null;
    onSizeChange?.(
      getResizedPanelSize({
        pointer: { x: event.clientX, y: event.clientY },
        session,
      })
    );
    resizeSessionRef.current = null;
    setResizingEdge(null);

    if (event.currentTarget.hasPointerCapture(session.pointerId)) {
      event.currentTarget.releasePointerCapture(session.pointerId);
    }
  };
  const handleResizeKeyDown = (
    event: ReactKeyboardEvent<HTMLDivElement>,
    { axis, edge }: ResizeHandleConfig
  ) => {
    const limits = getResizeLimits({
      layer,
      minSize,
      panel: panelRef.current,
      placement,
    });

    if (event.key === "Home") {
      event.preventDefault();
      commitSize(
        {
          height: axis === "vertical" ? limits.minHeight : size.height,
          width: axis === "horizontal" ? limits.minWidth : size.width,
        },
        limits
      );
      return;
    }

    if (event.key === "End") {
      event.preventDefault();
      commitSize(
        {
          height: axis === "vertical" ? limits.maxHeight : size.height,
          width: axis === "horizontal" ? limits.maxWidth : size.width,
        },
        limits
      );
      return;
    }

    const delta = getKeyboardResizeDelta({ axis, edge, key: event.key });
    if (delta == null) return;

    event.preventDefault();
    commitSize(
      {
        height: axis === "vertical" ? size.height + delta : size.height,
        width: axis === "horizontal" ? size.width + delta : size.width,
      },
      limits
    );
  };

  useEffect(() => {
    return () => {
      if (animationFrameIdRef.current != null) {
        window.cancelAnimationFrame(animationFrameIdRef.current);
        animationFrameIdRef.current = null;
      }
    };
  }, []);

  const stopModalLayerPropagation = (
    event: ReactSyntheticEvent<HTMLDivElement>
  ) => {
    if (layer === "modal") {
      event.stopPropagation();
    }
  };

  return (
    <div
      id={panelId}
      className="resizable-floating-panel"
      css={resizableFloatingPanelCSS}
      data-layer={layer}
      data-placement={placement}
      data-resizing={resizingEdge == null ? undefined : "true"}
      ref={panelRef}
      onClick={stopModalLayerPropagation}
      onPointerCancel={stopModalLayerPropagation}
      onPointerDown={stopModalLayerPropagation}
      onPointerMove={stopModalLayerPropagation}
      onPointerUp={stopModalLayerPropagation}
      style={
        {
          "--resizable-floating-panel-height": `${size.height}px`,
          "--resizable-floating-panel-min-height": `${minSize.height}px`,
          "--resizable-floating-panel-min-width": `${minSize.width}px`,
          "--resizable-floating-panel-width": `${size.width}px`,
        } as CSSProperties
      }
    >
      {resizeHandles.map((handle) => (
        <div
          key={handle.edge}
          role="separator"
          tabIndex={0}
          aria-controls={panelId}
          aria-label={
            handle.axis === "horizontal"
              ? "Resize assistant width"
              : "Resize assistant height"
          }
          aria-orientation={
            handle.axis === "horizontal" ? "vertical" : "horizontal"
          }
          aria-valuemax={Math.round(
            handle.axis === "horizontal"
              ? resizeLimits.maxWidth
              : resizeLimits.maxHeight
          )}
          aria-valuemin={Math.round(
            handle.axis === "horizontal"
              ? resizeLimits.minWidth
              : resizeLimits.minHeight
          )}
          aria-valuenow={Math.round(
            handle.axis === "horizontal" ? size.width : size.height
          )}
          className="resizable-floating-panel__resize-handle"
          data-edge={handle.edge}
          data-resizing={resizingEdge === handle.edge ? "true" : undefined}
          onKeyDown={(event) => handleResizeKeyDown(event, handle)}
          onPointerCancel={finishResize}
          onPointerDown={(event) => handleResizePointerDown(event, handle)}
          onPointerMove={handleResizePointerMove}
          onPointerUp={finishResize}
        />
      ))}
      {children}
    </div>
  );
}
