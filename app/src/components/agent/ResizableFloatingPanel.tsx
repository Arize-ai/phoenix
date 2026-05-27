import { css } from "@emotion/react";
import type {
  CSSProperties,
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
  ReactNode,
  RefObject,
  SyntheticEvent as ReactSyntheticEvent,
} from "react";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";

import {
  MODAL_FLOATING_UI_Z_INDEX,
  NON_MODAL_FLOATING_Z_INDEX,
} from "@phoenix/components/core/zIndex";
import type { AgentFabPlacement } from "@phoenix/store/agentStore";
import type { Bounds, Point, Size } from "@phoenix/types/geometry";

import {
  FAB_INSET,
  FAB_RESTING_SIZE,
  getFabPinnedPosition,
  getNearestFabPlacement,
} from "./agentFabPositioning";
import {
  getPositioningBounds,
  getViewportBounds,
} from "./floatingPositioningBounds";
import { useModalFloatingLayerInteractivity } from "./useModalFloatingLayerInteractivity";

const FULLSCREEN_BREAKPOINT_PX = 600;
const KEYBOARD_RESIZE_STEP_PX = 24;
const PRIMARY_POINTER_BUTTON = 0;
const DRAG_START_THRESHOLD_PX = 4;
const RESIZE_HANDLE_SIZE_PX = 14;
const FLOATING_ACTION_WIDTH_PX = FAB_RESTING_SIZE.width;
const FLOATING_ACTION_HEIGHT_PX = FAB_RESTING_SIZE.height;
const FLOATING_ACTION_GAP_PX = 8;
const VIEWPORT_MARGIN_PX = FAB_INSET.horizontal;
const VIEWPORT_VERTICAL_MARGIN_PX = FAB_INSET.vertical;
const FLOATING_PANEL_PLACEMENTS: AgentFabPlacement[] = [
  "top-start",
  "top-end",
  "bottom-start",
  "bottom-end",
];

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
  bounds: Bounds;
  dragStarted: boolean;
  pointerId: number;
  source: "floating-action" | "header";
  startGeometry: FloatingPanelGeometry;
  startPointer: Point;
};

export type ResizableFloatingPanelProps = {
  boundaryRef?: RefObject<HTMLElement | null>;
  children: ReactNode;
  floatingAction?: ReactNode;
  layer?: FloatingPanelLayer;
  minSize: Size;
  onPlacementChange?: (placement: AgentFabPlacement) => void;
  placement: AgentFabPlacement;
  size: Size;
  onSizeChange?: (size: Size) => void;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getViewportSize(): Size {
  const viewportBounds = getViewportBounds();
  return { height: viewportBounds.height, width: viewportBounds.width };
}

function isFullscreenFloatingPanel() {
  const viewport = getViewportSize();
  return (
    viewport.width <= FULLSCREEN_BREAKPOINT_PX ||
    viewport.height <= FULLSCREEN_BREAKPOINT_PX
  );
}

function getAttachmentHeight(hasFloatingAction: boolean) {
  return hasFloatingAction
    ? FLOATING_ACTION_GAP_PX + FLOATING_ACTION_HEIGHT_PX
    : 0;
}

function getMinPanelX(bounds: Bounds) {
  return bounds.left + VIEWPORT_MARGIN_PX;
}

function getMinPanelY({
  bounds,
  hasFloatingAction,
  placement,
}: {
  bounds: Bounds;
  hasFloatingAction: boolean;
  placement: AgentFabPlacement;
}) {
  return (
    bounds.top +
    VIEWPORT_VERTICAL_MARGIN_PX +
    (hasFloatingAction && placement.startsWith("top")
      ? getAttachmentHeight(true)
      : 0)
  );
}

function getMaxPanelX({
  bounds,
  width,
}: {
  bounds: Bounds;
  width: number;
}) {
  return Math.max(
    bounds.left + bounds.width - width - VIEWPORT_MARGIN_PX,
    getMinPanelX(bounds)
  );
}

function getMaxPanelY({
  bounds,
  height,
  hasFloatingAction,
  placement,
}: {
  bounds: Bounds;
  height: number;
  hasFloatingAction: boolean;
  placement: AgentFabPlacement;
}) {
  return Math.max(
    bounds.top +
      bounds.height -
      height -
      VIEWPORT_VERTICAL_MARGIN_PX -
      (hasFloatingAction && placement.startsWith("bottom")
        ? getAttachmentHeight(true)
        : 0),
    getMinPanelY({ bounds, hasFloatingAction, placement })
  );
}

function getGeometryLimits({
  bounds,
  hasFloatingAction,
  minSize,
}: {
  bounds: Bounds;
  hasFloatingAction: boolean;
  minSize: Size;
}): ResizeLimits {
  const maxWidth = Math.max(bounds.width - VIEWPORT_MARGIN_PX * 2, 0);
  const maxHeight = Math.max(
    bounds.height - VIEWPORT_VERTICAL_MARGIN_PX * 2 - getAttachmentHeight(hasFloatingAction),
    0
  );

  return {
    maxHeight,
    maxWidth,
    minHeight: Math.min(minSize.height, maxHeight),
    minWidth: Math.min(minSize.width, maxWidth),
  };
}

function getFloatingActionPosition({
  geometry,
  placement,
}: {
  geometry: FloatingPanelGeometry;
  placement: AgentFabPlacement;
}): Point {
  return {
    x: placement.endsWith("end")
      ? geometry.x + geometry.width - FLOATING_ACTION_WIDTH_PX
      : geometry.x,
    y: placement.startsWith("bottom")
      ? geometry.y + geometry.height + FLOATING_ACTION_GAP_PX
      : geometry.y - FLOATING_ACTION_HEIGHT_PX - FLOATING_ACTION_GAP_PX,
  };
}

function getPinnedGeometry({
  bounds,
  hasFloatingAction,
  minSize,
  placement,
  size,
}: {
  bounds: Bounds;
  hasFloatingAction: boolean;
  minSize: Size;
  placement: AgentFabPlacement;
  size: Size;
}): FloatingPanelGeometry {
  const limits = getGeometryLimits({ bounds, hasFloatingAction, minSize });
  const width = clamp(size.width, limits.minWidth, limits.maxWidth);
  const height = clamp(size.height, limits.minHeight, limits.maxHeight);
  if (!hasFloatingAction) {
    const x = placement.endsWith("end")
      ? bounds.left + bounds.width - width - VIEWPORT_MARGIN_PX
      : bounds.left + VIEWPORT_MARGIN_PX;
    const y = placement.startsWith("bottom")
      ? bounds.top + bounds.height - height - VIEWPORT_VERTICAL_MARGIN_PX
      : bounds.top + VIEWPORT_VERTICAL_MARGIN_PX;

    return clampGeometry({
      bounds,
      geometry: { height, width, x, y },
      hasFloatingAction,
      minSize,
      placement,
    });
  }

  const floatingActionPosition = getFabPinnedPosition({
    placement,
    bounds,
    size: {
      height: FLOATING_ACTION_HEIGHT_PX,
      width: FLOATING_ACTION_WIDTH_PX,
    },
    inset: FAB_INSET,
  });
  const x = placement.endsWith("end")
    ? floatingActionPosition.x + FLOATING_ACTION_WIDTH_PX - width
    : floatingActionPosition.x;
  const y = placement.startsWith("bottom")
    ? floatingActionPosition.y - FLOATING_ACTION_GAP_PX - height
    : floatingActionPosition.y + FLOATING_ACTION_HEIGHT_PX + FLOATING_ACTION_GAP_PX;

  return clampGeometry({
    bounds,
    geometry: { height, width, x, y },
    hasFloatingAction,
    minSize,
    placement,
  });
}

function clampGeometry({
  bounds,
  geometry,
  hasFloatingAction,
  minSize,
  placement,
}: {
  bounds: Bounds;
  geometry: FloatingPanelGeometry;
  hasFloatingAction: boolean;
  minSize: Size;
  placement: AgentFabPlacement;
}): FloatingPanelGeometry {
  const limits = getGeometryLimits({ bounds, hasFloatingAction, minSize });
  const width = clamp(geometry.width, limits.minWidth, limits.maxWidth);
  const height = clamp(geometry.height, limits.minHeight, limits.maxHeight);
  const minX = getMinPanelX(bounds);
  const minY = getMinPanelY({ bounds, hasFloatingAction, placement });
  const maxX = getMaxPanelX({ bounds, width });
  const maxY = getMaxPanelY({
    bounds,
    height,
    hasFloatingAction,
    placement,
  });

  return {
    height,
    width,
    x: clamp(geometry.x, minX, maxX),
    y: clamp(geometry.y, minY, maxY),
  };
}

function getNearestPlacementForGeometry({
  bounds,
  geometry,
}: {
  bounds: Bounds;
  geometry: FloatingPanelGeometry;
}): AgentFabPlacement {
  let nearestPlacement = FLOATING_PANEL_PLACEMENTS[0];
  let nearestSquaredDistance = Number.POSITIVE_INFINITY;

  for (const candidatePlacement of FLOATING_PANEL_PLACEMENTS) {
    const candidateActionPoint = getFloatingActionPosition({
      geometry,
      placement: candidatePlacement,
    });
    const pinnedActionPoint = getFabPinnedPosition({
      placement: candidatePlacement,
      bounds,
      size: {
        height: FLOATING_ACTION_HEIGHT_PX,
        width: FLOATING_ACTION_WIDTH_PX,
      },
      inset: FAB_INSET,
    });
    const squaredDistance =
      (candidateActionPoint.x - pinnedActionPoint.x) ** 2 +
      (candidateActionPoint.y - pinnedActionPoint.y) ** 2;

    if (squaredDistance < nearestSquaredDistance) {
      nearestSquaredDistance = squaredDistance;
      nearestPlacement = candidatePlacement;
    }
  }

  return nearestPlacement;
}

function getResizedGeometry({
  bounds,
  hasFloatingAction,
  minSize,
  placement,
  pointer,
  session,
}: {
  bounds: Bounds;
  hasFloatingAction: boolean;
  minSize: Size;
  placement: AgentFabPlacement;
  pointer: Point;
  session: ResizeSession;
}): FloatingPanelGeometry {
  const start = session.startGeometry;
  const limits = getGeometryLimits({ bounds, hasFloatingAction, minSize });
  const widthDelta = start.x - pointer.x;
  const heightDelta = start.y - pointer.y;
  const maxWidth = Math.min(
    limits.maxWidth,
    start.x + start.width - getMinPanelX(bounds)
  );
  const maxHeight = Math.min(
    limits.maxHeight,
    start.y +
      start.height -
      getMinPanelY({ bounds, hasFloatingAction, placement })
  );
  const width = clamp(start.width + widthDelta, limits.minWidth, maxWidth);
  const height = clamp(start.height + heightDelta, limits.minHeight, maxHeight);

  return clampGeometry({
    bounds,
    geometry: {
      ...start,
      height,
      width,
      x: start.x + start.width - width,
      y: start.y + start.height - height,
    },
    hasFloatingAction,
    minSize,
    placement,
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
  cursor: grab;
  z-index: ${NON_MODAL_FLOATING_Z_INDEX};

  &[data-placement^="top"] {
    top: calc(
      var(--resizable-floating-panel-y) - ${FLOATING_ACTION_HEIGHT_PX}px -
        ${FLOATING_ACTION_GAP_PX}px
    );
  }

  &[data-placement^="bottom"] {
    top: calc(
      var(--resizable-floating-panel-y) +
        var(--resizable-floating-panel-height) + ${FLOATING_ACTION_GAP_PX}px
    );
  }

  &[data-placement$="start"] {
    left: var(--resizable-floating-panel-x);
  }

  &[data-placement$="end"] {
    left: calc(
      var(--resizable-floating-panel-x) +
        var(--resizable-floating-panel-width) - ${FLOATING_ACTION_WIDTH_PX}px
    );
  }

  &[data-layer="modal"] {
    z-index: ${MODAL_FLOATING_UI_Z_INDEX};
  }

  &[data-moving="true"],
  &[data-moving="true"] * {
    cursor: grabbing;
  }

  @media (max-width: ${FULLSCREEN_BREAKPOINT_PX}px), (max-height: ${FULLSCREEN_BREAKPOINT_PX}px) {
    right: var(--global-dimension-size-200);
    bottom: var(--global-dimension-size-200);
    top: auto;
    left: auto;
  }
`;

export function ResizableFloatingPanel({
  boundaryRef,
  children,
  floatingAction,
  layer = "content",
  minSize,
  onPlacementChange,
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
  const suppressFloatingActionClickRef = useRef(false);
  const suppressFloatingActionClickResetTimeoutIdRef = useRef<number | null>(
    null
  );
  const [resizingEdge, setResizingEdge] = useState<ResizeEdge | null>(null);
  const [isMoving, setIsMoving] = useState(false);
  const [isResizeHandleHovered, setIsResizeHandleHovered] = useState(false);
  const hasFloatingAction = Boolean(floatingAction);
  const requiresBoundary = Boolean(boundaryRef);
  const [resolvedBoundary, setResolvedBoundary] = useState<HTMLElement | null>(
    () => boundaryRef?.current ?? null
  );
  const [currentGeometry, setCurrentGeometry] = useState(() =>
    getPinnedGeometry({
      bounds:
        getPositioningBounds({
          boundary: boundaryRef?.current,
          requiresBoundary: Boolean(boundaryRef),
        }) ?? getViewportBounds(),
      hasFloatingAction,
      minSize,
      placement,
      size,
    })
  );
  useModalFloatingLayerInteractivity(panelRef, layer === "modal");
  useModalFloatingLayerInteractivity(floatingActionRef, layer === "modal");

  const getBounds = (): Bounds =>
    getPositioningBounds({
      boundary: resolvedBoundary,
      requiresBoundary,
    }) ?? getViewportBounds();

  const resizeLimits = getGeometryLimits({
    bounds: getBounds(),
    hasFloatingAction,
    minSize,
  });
  const resizeHandles: ResizeEdge[] = ["top-left"];
  const displayedGeometry = clampGeometry({
    bounds: getBounds(),
    geometry: currentGeometry,
    hasFloatingAction,
    minSize,
    placement,
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
      bounds: getBounds(),
      geometry: nextGeometry,
      hasFloatingAction,
      minSize,
      placement,
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
      bounds: getBounds(),
      geometry: nextGeometry,
      hasFloatingAction,
      minSize,
      placement,
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
  const scheduleSuppressFloatingActionClickReset = () => {
    if (suppressFloatingActionClickResetTimeoutIdRef.current != null) {
      window.clearTimeout(suppressFloatingActionClickResetTimeoutIdRef.current);
    }
    suppressFloatingActionClickResetTimeoutIdRef.current = window.setTimeout(
      () => {
        suppressFloatingActionClickRef.current = false;
        suppressFloatingActionClickResetTimeoutIdRef.current = null;
      },
      0
    );
  };
  const handleResizePointerDown = (
    event: ReactPointerEvent<HTMLDivElement>,
    edge: ResizeEdge
  ) => {
    if (event.button !== PRIMARY_POINTER_BUTTON) return;

    event.currentTarget.focus();
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
        bounds: getBounds(),
        hasFloatingAction,
        minSize,
        placement,
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
        bounds: getBounds(),
        hasFloatingAction,
        minSize,
        placement,
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
  const startMove = ({
    event,
    source,
  }: {
    event: ReactPointerEvent<HTMLDivElement>;
    source: MoveSession["source"];
  }) => {
    if (
      event.button !== PRIMARY_POINTER_BUTTON ||
      isFullscreenFloatingPanel()
    ) {
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);
    moveSessionRef.current = {
      bounds: getBounds(),
      dragStarted: source === "header",
      pointerId: event.pointerId,
      source,
      startGeometry: displayedGeometry,
      startPointer: { x: event.clientX, y: event.clientY },
    };
    setIsMoving(source === "header");
    event.preventDefault();
  };
  const handlePanelMovePointerDown = (
    event: ReactPointerEvent<HTMLDivElement>
  ) => {
    if (!isHeaderDragTarget(event.target)) return;
    startMove({ event, source: "header" });
  };
  const handleFloatingActionMovePointerDown = (
    event: ReactPointerEvent<HTMLDivElement>
  ) => {
    startMove({ event, source: "floating-action" });
  };
  const handleMovePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const session = moveSessionRef.current;
    if (!session) return;

    if (!session.dragStarted) {
      const squaredDistance =
        (event.clientX - session.startPointer.x) ** 2 +
        (event.clientY - session.startPointer.y) ** 2;
      if (squaredDistance < DRAG_START_THRESHOLD_PX ** 2) {
        return;
      }
      session.dragStarted = true;
      setIsMoving(true);
    }

    scheduleGeometryUpdate(
      clampGeometry({
        bounds: session.bounds,
        geometry: {
          ...session.startGeometry,
          x: session.startGeometry.x + event.clientX - session.startPointer.x,
          y: session.startGeometry.y + event.clientY - session.startPointer.y,
        },
        hasFloatingAction,
        minSize,
        placement,
      })
    );
    event.preventDefault();
  };
  const finishMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const session = moveSessionRef.current;
    if (!session) return;

    if (!session.dragStarted) {
      moveSessionRef.current = null;
      if (event.currentTarget.hasPointerCapture(session.pointerId)) {
        event.currentTarget.releasePointerCapture(session.pointerId);
      }
      return;
    }

    const draggedGeometry = clampGeometry({
      bounds: session.bounds,
      geometry: {
        ...session.startGeometry,
        x: session.startGeometry.x + event.clientX - session.startPointer.x,
        y: session.startGeometry.y + event.clientY - session.startPointer.y,
      },
      hasFloatingAction,
      minSize,
      placement,
    });
    const nextPlacement = hasFloatingAction
      ? getNearestPlacementForGeometry({
          bounds: session.bounds,
          geometry: draggedGeometry,
        })
      : getNearestFabPlacement({
          point: {
            x: draggedGeometry.x,
            y: draggedGeometry.y,
          },
          bounds: session.bounds,
          size: {
            height: FLOATING_ACTION_HEIGHT_PX,
            width: FLOATING_ACTION_WIDTH_PX,
          },
          inset: FAB_INSET,
        });

    cancelPendingGeometryUpdate();
    commitGeometry({
      nextGeometry: getPinnedGeometry({
        bounds: session.bounds,
        hasFloatingAction,
        minSize,
        placement: nextPlacement,
        size: {
          height: draggedGeometry.height,
          width: draggedGeometry.width,
        },
      }),
      shouldCommitSize: false,
    });
    moveSessionRef.current = null;
    setIsMoving(false);

    if (session.source === "floating-action") {
      suppressFloatingActionClickRef.current = true;
      scheduleSuppressFloatingActionClickReset();
    }

    if (nextPlacement !== placement) {
      onPlacementChange?.(nextPlacement);
    }

    if (event.currentTarget.hasPointerCapture(session.pointerId)) {
      event.currentTarget.releasePointerCapture(session.pointerId);
    }
  };
  const handleMoveLostPointerCapture = () => {
    const session = moveSessionRef.current;
    if (!session) return;

    if (!session.dragStarted) {
      moveSessionRef.current = null;
      return;
    }

    cancelPendingGeometryUpdate();
    commitGeometry({
      nextGeometry: latestGeometryRef.current ?? displayedGeometry,
      shouldCommitSize: false,
    });
    moveSessionRef.current = null;
    setIsMoving(false);
  };
  const handleFloatingActionClickCapture = (
    event: ReactSyntheticEvent<HTMLDivElement>
  ) => {
    if (!suppressFloatingActionClickRef.current) return;

    suppressFloatingActionClickRef.current = false;
    if (suppressFloatingActionClickResetTimeoutIdRef.current != null) {
      window.clearTimeout(suppressFloatingActionClickResetTimeoutIdRef.current);
      suppressFloatingActionClickResetTimeoutIdRef.current = null;
    }
    event.preventDefault();
    event.stopPropagation();
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

  useLayoutEffect(() => {
    if (!requiresBoundary) {
      setResolvedBoundary(null);
      return;
    }

    let animationFrameId: number | null = null;
    const syncBoundaryElement = () => {
      const nextBoundary = boundaryRef?.current ?? null;
      setResolvedBoundary((currentBoundary) =>
        currentBoundary === nextBoundary ? currentBoundary : nextBoundary
      );

      if (!nextBoundary) {
        animationFrameId = window.requestAnimationFrame(syncBoundaryElement);
      }
    };

    syncBoundaryElement();

    return () => {
      if (animationFrameId != null) {
        window.cancelAnimationFrame(animationFrameId);
      }
    };
  }, [boundaryRef, requiresBoundary]);

  useEffect(() => {
    setCurrentGeometry((geometry) =>
      clampGeometry({
        bounds: getBounds(),
        geometry: {
          ...geometry,
          height: size.height,
          width: size.width,
        },
        hasFloatingAction,
        minSize,
        placement,
      })
    );
  }, [hasFloatingAction, minSize, size]);

  useLayoutEffect(() => {
    const syncPinnedGeometry = () => {
      if (moveSessionRef.current || resizeSessionRef.current) {
        return;
      }

      const bounds = getBounds();
      setCurrentGeometry((geometry) =>
        getPinnedGeometry({
          bounds,
          hasFloatingAction,
          minSize,
          placement,
          size: {
            height: geometry.height,
            width: geometry.width,
          },
        })
      );
    };

    syncPinnedGeometry();

    const observer =
      resolvedBoundary && typeof ResizeObserver === "function"
        ? new ResizeObserver(syncPinnedGeometry)
        : null;
    if (resolvedBoundary && observer) {
      observer.observe(resolvedBoundary);
    }
    window.visualViewport?.addEventListener("resize", syncPinnedGeometry);
    window.visualViewport?.addEventListener("scroll", syncPinnedGeometry);

    return () => {
      observer?.disconnect();
      window.visualViewport?.removeEventListener("resize", syncPinnedGeometry);
      window.visualViewport?.removeEventListener("scroll", syncPinnedGeometry);
    };
  }, [
    hasFloatingAction,
    minSize,
    placement,
    requiresBoundary,
    resolvedBoundary,
  ]);

  useEffect(() => {
    return () => {
      cancelPendingGeometryUpdate();
      if (suppressFloatingActionClickResetTimeoutIdRef.current != null) {
        window.clearTimeout(suppressFloatingActionClickResetTimeoutIdRef.current);
        suppressFloatingActionClickResetTimeoutIdRef.current = null;
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
          data-moving={isMoving ? "true" : undefined}
          data-placement={placement}
          ref={floatingActionRef}
          style={floatingPanelStyle}
          onClick={stopModalLayerPropagation}
          onClickCapture={handleFloatingActionClickCapture}
          onLostPointerCaptureCapture={handleMoveLostPointerCapture}
          onPointerCancel={stopModalLayerPropagation}
          onPointerCancelCapture={(event) => {
            stopModalLayerPropagation(event);
            finishMove(event);
          }}
          onPointerDown={stopModalLayerPropagation}
          onPointerDownCapture={(event) => {
            stopModalLayerPropagation(event);
            handleFloatingActionMovePointerDown(event);
          }}
          onPointerMove={stopModalLayerPropagation}
          onPointerMoveCapture={(event) => {
            stopModalLayerPropagation(event);
            handleMovePointerMove(event);
          }}
          onPointerUp={stopModalLayerPropagation}
          onPointerUpCapture={(event) => {
            stopModalLayerPropagation(event);
            finishMove(event);
          }}
        >
          {floatingAction}
        </div>
      ) : null}
    </>
  );
}
