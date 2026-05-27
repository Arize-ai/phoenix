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

import { FAB_INSET, FAB_RESTING_SIZE } from "./agentFabPositioning";
import { useModalFloatingLayerInteractivity } from "./useModalFloatingLayerInteractivity";

const FULLSCREEN_BREAKPOINT_PX = 600;
const KEYBOARD_RESIZE_STEP_PX = 24;
const PRIMARY_POINTER_BUTTON = 0;
const RESIZE_HANDLE_SIZE_PX = 14;
const FLOATING_ACTION_WIDTH_PX = FAB_RESTING_SIZE.width;
const FLOATING_ACTION_HEIGHT_PX = FAB_RESTING_SIZE.height;
const FLOATING_ACTION_GAP_PX = 8;
const VIEWPORT_MARGIN_PX = FAB_INSET.horizontal;
const VIEWPORT_VERTICAL_MARGIN_PX = FAB_INSET.vertical;

type FloatingPanelLayer = "content" | "modal";

type FloatingPanelGeometry = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type ResizeEdge = "top-left";

type ResizeLimits = {
  maxHeight: number;
  maxWidth: number;
  minHeight: number;
  minWidth: number;
};

type ResizeSession = {
  pointerId: number;
  startGeometry: FloatingPanelGeometry;
};

type MoveSession = {
  pointerId: number;
  startGeometry: FloatingPanelGeometry;
  startPointer: Point;
};

export type ResizableFloatingPanelProps = {
  children: ReactNode;
  floatingAction?: ReactNode;
  layer?: FloatingPanelLayer;
  minSize: Size;
  placement: AgentFabPlacement;
  size: Size;
  onSizeChange?: (size: Size) => void;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getViewportSize(): Size {
  if (typeof window === "undefined") {
    return { height: 0, width: 0 };
  }
  return { height: window.innerHeight, width: window.innerWidth };
}

function isFullscreenFloatingPanel() {
  const viewport = getViewportSize();
  return (
    viewport.width <= FULLSCREEN_BREAKPOINT_PX ||
    viewport.height <= FULLSCREEN_BREAKPOINT_PX
  );
}

function getGeometryLimits(minSize: Size): ResizeLimits {
  const viewport = getViewportSize();
  const maxWidth = Math.max(viewport.width - VIEWPORT_MARGIN_PX * 2, 0);
  const maxHeight = Math.max(
    viewport.height - VIEWPORT_VERTICAL_MARGIN_PX * 2,
    0
  );

  return {
    maxHeight,
    maxWidth,
    minHeight: Math.min(minSize.height, maxHeight),
    minWidth: Math.min(minSize.width, maxWidth),
  };
}

function getDefaultGeometry({
  hasFloatingAction,
  minSize,
  placement,
  size,
}: {
  hasFloatingAction: boolean;
  minSize: Size;
  placement: AgentFabPlacement;
  size: Size;
}): FloatingPanelGeometry {
  const limits = getGeometryLimits(minSize);
  const width = clamp(size.width, limits.minWidth, limits.maxWidth);
  const height = clamp(size.height, limits.minHeight, limits.maxHeight);
  const x = placement.endsWith("end")
    ? getViewportSize().width - width - VIEWPORT_MARGIN_PX
    : VIEWPORT_MARGIN_PX;
  const y = placement.startsWith("bottom")
    ? getViewportSize().height -
      height -
      (hasFloatingAction
        ? FLOATING_ACTION_GAP_PX + FLOATING_ACTION_HEIGHT_PX
        : 0) -
      VIEWPORT_VERTICAL_MARGIN_PX
    : VIEWPORT_VERTICAL_MARGIN_PX;

  return clampGeometry({
    geometry: { height, width, x, y },
    hasFloatingAction,
    minSize,
  });
}

function clampGeometry({
  geometry,
  hasFloatingAction,
  minSize,
}: {
  geometry: FloatingPanelGeometry;
  hasFloatingAction: boolean;
  minSize: Size;
}): FloatingPanelGeometry {
  const limits = getGeometryLimits(minSize);
  const width = clamp(geometry.width, limits.minWidth, limits.maxWidth);
  const height = clamp(geometry.height, limits.minHeight, limits.maxHeight);
  const bottomAttachmentHeight = hasFloatingAction
    ? FLOATING_ACTION_GAP_PX + FLOATING_ACTION_HEIGHT_PX
    : 0;
  const maxX = Math.max(
    getViewportSize().width - width - VIEWPORT_MARGIN_PX,
    VIEWPORT_MARGIN_PX
  );
  const maxY = Math.max(
    getViewportSize().height -
      height -
      bottomAttachmentHeight -
      VIEWPORT_VERTICAL_MARGIN_PX,
    VIEWPORT_VERTICAL_MARGIN_PX
  );

  return {
    height,
    width,
    x: clamp(geometry.x, VIEWPORT_MARGIN_PX, maxX),
    y: clamp(geometry.y, VIEWPORT_VERTICAL_MARGIN_PX, maxY),
  };
}

function getResizedGeometry({
  hasFloatingAction,
  minSize,
  pointer,
  session,
}: {
  hasFloatingAction: boolean;
  minSize: Size;
  pointer: Point;
  session: ResizeSession;
}): FloatingPanelGeometry {
  const start = session.startGeometry;
  const limits = getGeometryLimits(minSize);
  const widthDelta = start.x - pointer.x;
  const heightDelta = start.y - pointer.y;
  const maxWidth = Math.min(
    limits.maxWidth,
    start.x + start.width - VIEWPORT_MARGIN_PX
  );
  const maxHeight = Math.min(
    limits.maxHeight,
    start.y + start.height - VIEWPORT_VERTICAL_MARGIN_PX
  );
  const width = clamp(start.width + widthDelta, limits.minWidth, maxWidth);
  const height = clamp(start.height + heightDelta, limits.minHeight, maxHeight);

  return clampGeometry({
    geometry: {
      ...start,
      height,
      width,
      x: start.x + start.width - width,
      y: start.y + start.height - height,
    },
    hasFloatingAction,
    minSize,
  });
}

function getKeyboardResizeDelta({
  key,
}: {
  key: string;
}): { height: number; width: number } | null {
  switch (key) {
    case "ArrowLeft":
      return { height: 0, width: KEYBOARD_RESIZE_STEP_PX };
    case "ArrowRight":
      return { height: 0, width: -KEYBOARD_RESIZE_STEP_PX };
    case "ArrowDown":
      return { height: -KEYBOARD_RESIZE_STEP_PX, width: 0 };
    case "ArrowUp":
      return { height: KEYBOARD_RESIZE_STEP_PX, width: 0 };
    default:
      return null;
  }
}

function isHeaderDragTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  const header = target.closest(".agent-chat-panel__header");
  if (!header) return false;
  return !target.closest(
    'button, a, input, textarea, select, [role="button"], [role="menuitem"], [data-agent-chat-header-no-drag="true"]'
  );
}

const resizableFloatingPanelCSS = css`
  --resizable-floating-panel-viewport-margin: var(
    --global-dimension-size-400
  );

  position: fixed;
  z-index: ${NON_MODAL_FLOATING_Z_INDEX};
  top: var(--resizable-floating-panel-y);
  left: var(--resizable-floating-panel-x);
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  width: var(--resizable-floating-panel-width);
  height: var(--resizable-floating-panel-height);
  max-width: calc(100vw - var(--resizable-floating-panel-viewport-margin));
  max-height: calc(100vh - var(--resizable-floating-panel-viewport-margin));
  min-width: min(
    var(--resizable-floating-panel-min-width),
    calc(100vw - var(--resizable-floating-panel-viewport-margin))
  );
  min-height: min(
    var(--resizable-floating-panel-min-height),
    calc(100vh - var(--resizable-floating-panel-viewport-margin))
  );
  overflow: hidden;
  border: 1px solid var(--global-border-color-default);
  border-radius: var(--global-rounding-medium);
  background: var(--global-background-color-default);
  box-shadow:
    0 8px 20px rgba(0, 0, 0, 0.14),
    0 1px 3px rgba(0, 0, 0, 0.12);
  transition: border-color 150ms ease-out;

  &[data-resize-handle-highlighted="true"] {
    border-color: var(--global-color-gray-300);
  }

  &[data-moving="true"],
  &[data-resizing="true"] {
    user-select: none;
  }

  &[data-layer="modal"] {
    z-index: ${MODAL_FLOATING_UI_Z_INDEX};
  }

  .agent-chat-panel__header {
    cursor: grab;
    touch-action: none;
  }

  &[data-moving="true"] .agent-chat-panel__header {
    cursor: grabbing;
  }

  .resizable-floating-panel__resize-handle {
    display: none;
  }

  @media (max-width: ${FULLSCREEN_BREAKPOINT_PX}px), (max-height: ${FULLSCREEN_BREAKPOINT_PX}px) {
    inset: var(--global-dimension-size-100);
    width: auto;
    height: auto;
    max-width: none;
    max-height: none;
    min-height: 0;
    min-width: 0;

    .agent-chat-panel__header {
      cursor: default;
      touch-action: auto;
    }

    .resizable-floating-panel__resize-handle {
      display: none;
    }
  }
`;

const resizeHandleCSS = css`
  position: fixed;
  z-index: ${NON_MODAL_FLOATING_Z_INDEX + 1};
  border: none;
  outline: none;
  padding: 0;
  background: transparent;
  color: var(--global-color-gray-300);
  touch-action: none;
  transition: color 150ms ease-out;

  &::before,
  &::after {
    content: "";
    position: absolute;
    left: 4px;
    height: 1.5px;
    border-radius: 999px;
    background-color: currentColor;
    
    pointer-events: none;
    transform: rotate(-45deg);
    transform-origin: left center;
    transition: opacity 150ms ease-out;
  }

  &::before {
    top: 9px;
    width: 7px;
  }

  &::after {
    top: 12px;
    width: 11px;
  }

  &:focus-visible {
    outline: 2px solid var(--global-color-primary);
    outline-offset: -2px;
  }

  &[data-layer="modal"] {
    z-index: ${MODAL_FLOATING_UI_Z_INDEX + 1};
  }

  &[data-edge="top-left"] {
    top: var(--resizable-floating-panel-y);
    left: var(--resizable-floating-panel-x);
    width: ${RESIZE_HANDLE_SIZE_PX + 6}px;
    height: ${RESIZE_HANDLE_SIZE_PX + 6}px;
    cursor: nwse-resize;
  }

  &:hover,
  &[data-resizing="true"],
  &:focus-visible {
    color: var(--global-resize-handle-indicator-color-hover);
  }

  &:hover::before,
  &:hover::after,
  &[data-resizing="true"]::before,
  &[data-resizing="true"]::after,
  &:focus-visible::before,
  &:focus-visible::after {
    opacity: 1;
  }

  @media (max-width: ${FULLSCREEN_BREAKPOINT_PX}px), (max-height: ${FULLSCREEN_BREAKPOINT_PX}px) {
    display: none;
  }
`;

const floatingActionCSS = css`
  position: fixed;
  top: calc(
    var(--resizable-floating-panel-y) + var(--resizable-floating-panel-height) +
      ${FLOATING_ACTION_GAP_PX}px
  );
  left: calc(
    var(--resizable-floating-panel-x) + var(--resizable-floating-panel-width) -
      ${FLOATING_ACTION_WIDTH_PX}px
  );
  z-index: ${NON_MODAL_FLOATING_Z_INDEX};

  &[data-layer="modal"] {
    z-index: ${MODAL_FLOATING_UI_Z_INDEX};
  }

  @media (max-width: ${FULLSCREEN_BREAKPOINT_PX}px), (max-height: ${FULLSCREEN_BREAKPOINT_PX}px) {
    right: var(--global-dimension-size-200);
    bottom: var(--global-dimension-size-200);
    top: auto;
    left: auto;
  }
`;

export function ResizableFloatingPanel({
  children,
  floatingAction,
  layer = "content",
  minSize,
  placement,
  size,
  onSizeChange,
}: ResizableFloatingPanelProps) {
  const panelId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const floatingActionRef = useRef<HTMLDivElement>(null);
  const resizeSessionRef = useRef<ResizeSession | null>(null);
  const moveSessionRef = useRef<MoveSession | null>(null);
  const pendingGeometryRef = useRef<FloatingPanelGeometry | null>(null);
  const latestGeometryRef = useRef<FloatingPanelGeometry | null>(null);
  const animationFrameIdRef = useRef<number | null>(null);
  const [resizingEdge, setResizingEdge] = useState<ResizeEdge | null>(null);
  const [isMoving, setIsMoving] = useState(false);
  const [isResizeHandleHovered, setIsResizeHandleHovered] = useState(false);
  const hasFloatingAction = Boolean(floatingAction);
  const [currentGeometry, setCurrentGeometry] = useState(() =>
    getDefaultGeometry({ hasFloatingAction, minSize, placement, size })
  );
  useModalFloatingLayerInteractivity(panelRef, layer === "modal");
  useModalFloatingLayerInteractivity(floatingActionRef, layer === "modal");

  const resizeLimits = getGeometryLimits(minSize);
  const resizeHandles: ResizeEdge[] = ["top-left"];
  const displayedGeometry = clampGeometry({
    geometry: currentGeometry,
    hasFloatingAction,
    minSize,
  });
  const isResizeHandleHighlighted =
    isResizeHandleHovered || resizingEdge != null;
  latestGeometryRef.current = displayedGeometry;

  const commitSize = (nextGeometry: FloatingPanelGeometry) => {
    onSizeChange?.({
      height: nextGeometry.height,
      width: nextGeometry.width,
    });
  };
  const scheduleGeometryUpdate = (nextGeometry: FloatingPanelGeometry) => {
    const clampedGeometry = clampGeometry({
      geometry: nextGeometry,
      hasFloatingAction,
      minSize,
    });
    pendingGeometryRef.current = clampedGeometry;
    latestGeometryRef.current = clampedGeometry;

    if (animationFrameIdRef.current == null) {
      animationFrameIdRef.current = window.requestAnimationFrame(() => {
        animationFrameIdRef.current = null;
        if (pendingGeometryRef.current == null) return;
        setCurrentGeometry(pendingGeometryRef.current);
        pendingGeometryRef.current = null;
      });
    }
  };
  const commitGeometry = ({
    nextGeometry,
    shouldCommitSize,
  }: {
    nextGeometry: FloatingPanelGeometry;
    shouldCommitSize: boolean;
  }) => {
    const clampedGeometry = clampGeometry({
      geometry: nextGeometry,
      hasFloatingAction,
      minSize,
    });
    latestGeometryRef.current = clampedGeometry;
    setCurrentGeometry(clampedGeometry);
    if (shouldCommitSize) {
      commitSize(clampedGeometry);
    }
  };
  const cancelPendingGeometryUpdate = () => {
    if (animationFrameIdRef.current != null) {
      window.cancelAnimationFrame(animationFrameIdRef.current);
      animationFrameIdRef.current = null;
    }
    pendingGeometryRef.current = null;
  };
  const handleResizePointerDown = (
    event: ReactPointerEvent<HTMLDivElement>,
    edge: ResizeEdge
  ) => {
    if (event.button !== PRIMARY_POINTER_BUTTON) return;

    event.currentTarget.setPointerCapture(event.pointerId);
    resizeSessionRef.current = {
      pointerId: event.pointerId,
      startGeometry: displayedGeometry,
    };
    setResizingEdge(edge);
    event.preventDefault();
  };
  const handleResizePointerMove = (
    event: ReactPointerEvent<HTMLDivElement>
  ) => {
    const session = resizeSessionRef.current;
    if (!session) return;

    scheduleGeometryUpdate(
      getResizedGeometry({
        hasFloatingAction,
        minSize,
        pointer: { x: event.clientX, y: event.clientY },
        session,
      })
    );
    event.preventDefault();
  };
  const finishResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    const session = resizeSessionRef.current;
    if (!session) return;

    cancelPendingGeometryUpdate();
    commitGeometry({
      nextGeometry: getResizedGeometry({
        hasFloatingAction,
        minSize,
        pointer: { x: event.clientX, y: event.clientY },
        session,
      }),
      shouldCommitSize: true,
    });
    resizeSessionRef.current = null;
    setResizingEdge(null);

    if (event.currentTarget.hasPointerCapture(session.pointerId)) {
      event.currentTarget.releasePointerCapture(session.pointerId);
    }
  };
  const handleResizeLostPointerCapture = () => {
    if (!resizeSessionRef.current) return;

    cancelPendingGeometryUpdate();
    commitGeometry({
      nextGeometry: latestGeometryRef.current ?? displayedGeometry,
      shouldCommitSize: true,
    });
    resizeSessionRef.current = null;
    setResizingEdge(null);
  };
  const startMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (
      event.button !== PRIMARY_POINTER_BUTTON ||
      isFullscreenFloatingPanel()
    ) {
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);
    moveSessionRef.current = {
      pointerId: event.pointerId,
      startGeometry: displayedGeometry,
      startPointer: { x: event.clientX, y: event.clientY },
    };
    setIsMoving(true);
    event.preventDefault();
  };
  const handlePanelMovePointerDown = (
    event: ReactPointerEvent<HTMLDivElement>
  ) => {
    if (!isHeaderDragTarget(event.target)) return;
    startMove(event);
  };
  const handleMovePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const session = moveSessionRef.current;
    if (!session) return;

    scheduleGeometryUpdate(
      clampGeometry({
        geometry: {
          ...session.startGeometry,
          x: session.startGeometry.x + event.clientX - session.startPointer.x,
          y: session.startGeometry.y + event.clientY - session.startPointer.y,
        },
        hasFloatingAction,
        minSize,
      })
    );
    event.preventDefault();
  };
  const finishMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const session = moveSessionRef.current;
    if (!session) return;

    cancelPendingGeometryUpdate();
    commitGeometry({
      nextGeometry: clampGeometry({
        geometry: {
          ...session.startGeometry,
          x: session.startGeometry.x + event.clientX - session.startPointer.x,
          y: session.startGeometry.y + event.clientY - session.startPointer.y,
        },
        hasFloatingAction,
        minSize,
      }),
      shouldCommitSize: false,
    });
    moveSessionRef.current = null;
    setIsMoving(false);

    if (event.currentTarget.hasPointerCapture(session.pointerId)) {
      event.currentTarget.releasePointerCapture(session.pointerId);
    }
  };
  const handleMoveLostPointerCapture = () => {
    if (!moveSessionRef.current) return;

    cancelPendingGeometryUpdate();
    commitGeometry({
      nextGeometry: latestGeometryRef.current ?? displayedGeometry,
      shouldCommitSize: false,
    });
    moveSessionRef.current = null;
    setIsMoving(false);
  };
  const handleResizeKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const delta =
      event.key === "Home" || event.key === "End"
        ? null
        : getKeyboardResizeDelta({ key: event.key });
    if (delta == null && event.key !== "Home" && event.key !== "End") return;

    event.preventDefault();

    const maxWidth =
      displayedGeometry.x + displayedGeometry.width - VIEWPORT_MARGIN_PX;
    const maxHeight =
      displayedGeometry.y +
      displayedGeometry.height -
      VIEWPORT_VERTICAL_MARGIN_PX;
    const width =
      event.key === "Home"
        ? resizeLimits.minWidth
        : event.key === "End"
          ? maxWidth
          : displayedGeometry.width + delta!.width;
    const height =
      event.key === "Home"
        ? resizeLimits.minHeight
        : event.key === "End"
          ? maxHeight
          : displayedGeometry.height + delta!.height;
    const nextWidth = clamp(
      width,
      resizeLimits.minWidth,
      Math.min(resizeLimits.maxWidth, maxWidth)
    );
    const nextHeight = clamp(
      height,
      resizeLimits.minHeight,
      Math.min(resizeLimits.maxHeight, maxHeight)
    );

    commitGeometry({
      nextGeometry: {
        ...displayedGeometry,
        height: nextHeight,
        width: nextWidth,
        x: displayedGeometry.x + displayedGeometry.width - nextWidth,
        y: displayedGeometry.y + displayedGeometry.height - nextHeight,
      },
      shouldCommitSize: true,
    });
  };

  useEffect(() => {
    setCurrentGeometry((geometry) =>
      clampGeometry({
        geometry: {
          ...geometry,
          height: size.height,
          width: size.width,
        },
        hasFloatingAction,
        minSize,
      })
    );
  }, [hasFloatingAction, minSize, size]);

  useEffect(() => {
    setCurrentGeometry((geometry) =>
      getDefaultGeometry({
        hasFloatingAction,
        minSize,
        placement,
        size: {
          height: geometry.height,
          width: geometry.width,
        },
      })
    );
  }, [hasFloatingAction, minSize, placement]);

  useEffect(() => {
    return cancelPendingGeometryUpdate;
  }, []);

  const stopModalLayerPropagation = (
    event: ReactSyntheticEvent<HTMLDivElement>
  ) => {
    if (layer === "modal") {
      event.stopPropagation();
    }
  };

  const floatingPanelStyle = {
    "--resizable-floating-panel-height": `${displayedGeometry.height}px`,
    "--resizable-floating-panel-min-height": `${minSize.height}px`,
    "--resizable-floating-panel-min-width": `${minSize.width}px`,
    "--resizable-floating-panel-width": `${displayedGeometry.width}px`,
    "--resizable-floating-panel-x": `${displayedGeometry.x}px`,
    "--resizable-floating-panel-y": `${displayedGeometry.y}px`,
  } as CSSProperties;

  return (
    <>
      {resizeHandles.map((edge) => (
        <div
          key={edge}
          role="separator"
          tabIndex={0}
          aria-controls={panelId}
          aria-label="Resize assistant"
          aria-valuemax={Math.round(
            Math.min(resizeLimits.maxWidth, resizeLimits.maxHeight)
          )}
          aria-valuemin={Math.round(
            Math.min(resizeLimits.minWidth, resizeLimits.minHeight)
          )}
          aria-valuenow={Math.round(
            Math.min(displayedGeometry.width, displayedGeometry.height)
          )}
          className="resizable-floating-panel__resize-handle"
          css={resizeHandleCSS}
          data-layer={layer}
          data-edge={edge}
          data-resizing={resizingEdge === edge ? "true" : undefined}
          style={floatingPanelStyle}
          onKeyDown={handleResizeKeyDown}
          onLostPointerCapture={handleResizeLostPointerCapture}
          onPointerEnter={() => setIsResizeHandleHovered(true)}
          onPointerLeave={() => setIsResizeHandleHovered(false)}
          onPointerCancel={finishResize}
          onPointerDown={(event) => handleResizePointerDown(event, edge)}
          onPointerMove={handleResizePointerMove}
          onPointerUp={finishResize}
        />
      ))}
      <div
        id={panelId}
        className="resizable-floating-panel"
        css={resizableFloatingPanelCSS}
        data-layer={layer}
        data-moving={isMoving ? "true" : undefined}
        data-placement={placement}
        data-resize-handle-highlighted={
          isResizeHandleHighlighted ? "true" : undefined
        }
        data-resizing={resizingEdge == null ? undefined : "true"}
        ref={panelRef}
        onClick={stopModalLayerPropagation}
        onLostPointerCapture={handleMoveLostPointerCapture}
        onPointerCancel={(event) => {
          stopModalLayerPropagation(event);
          finishMove(event);
        }}
        onPointerDown={(event) => {
          stopModalLayerPropagation(event);
          handlePanelMovePointerDown(event);
        }}
        onPointerMove={(event) => {
          stopModalLayerPropagation(event);
          handleMovePointerMove(event);
        }}
        onPointerUp={(event) => {
          stopModalLayerPropagation(event);
          finishMove(event);
        }}
        style={floatingPanelStyle}
      >
        {children}
      </div>
      {floatingAction ? (
        <div
          className="resizable-floating-panel__floating-action"
          css={floatingActionCSS}
          data-layer={layer}
          ref={floatingActionRef}
          style={floatingPanelStyle}
          onClick={stopModalLayerPropagation}
          onPointerCancel={stopModalLayerPropagation}
          onPointerDown={stopModalLayerPropagation}
          onPointerMove={stopModalLayerPropagation}
          onPointerUp={stopModalLayerPropagation}
        >
          {floatingAction}
        </div>
      ) : null}
    </>
  );
}
