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
import { assertUnreachable } from "@phoenix/typeUtils";

import { FAB_INSET } from "./agentFabPositioning";
import { useModalFloatingLayerInteractivity } from "./useModalFloatingLayerInteractivity";

const FULLSCREEN_BREAKPOINT_PX = 600;
const KEYBOARD_RESIZE_STEP_PX = 24;
const PRIMARY_POINTER_BUTTON = 0;
const RESIZE_CORNER_HANDLE_SIZE_PX = 20;
const RESIZE_EDGE_HANDLE_THICKNESS_PX = 8;
const VIEWPORT_MARGIN_PX = FAB_INSET.horizontal;
const VIEWPORT_VERTICAL_MARGIN_PX = FAB_INSET.vertical;

type FloatingPanelLayer = "content" | "modal";

type FloatingPanelGeometry = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type ResizeEdge =
  | "top"
  | "right"
  | "bottom"
  | "left"
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right";

const RESIZE_EDGES: ResizeEdge[] = [
  "top",
  "right",
  "bottom",
  "left",
  "top-left",
  "top-right",
  "bottom-left",
  "bottom-right",
];

type ResizeLimits = {
  maxHeight: number;
  maxWidth: number;
  minHeight: number;
  minWidth: number;
};

type ResizeSession = {
  edge: ResizeEdge;
  pointerId: number;
  startGeometry: FloatingPanelGeometry;
};

type MoveSession = {
  pointerId: number;
  startGeometry: FloatingPanelGeometry;
  startPointer: Point;
};

export type ResizableFloatingPanelProps = {
  boundaryRef?: RefObject<HTMLElement | null>;
  children: ReactNode;
  layer?: FloatingPanelLayer;
  minSize: Size;
  placement: AgentFabPlacement;
  size: Size;
  onSizeChange?: (size: Size) => void;
  /**
   * Anchor the panel to the viewport instead of the boundary element, even on
   * the content layer. Keep content-layer callers boundary-bound when their FAB
   * is also boundary-bound.
   */
  anchorToViewport?: boolean;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function isLeftResizeEdge(edge: ResizeEdge) {
  return edge.endsWith("left");
}

function isRightResizeEdge(edge: ResizeEdge) {
  return edge.endsWith("right");
}

function isTopResizeEdge(edge: ResizeEdge) {
  return edge.startsWith("top");
}

function isBottomResizeEdge(edge: ResizeEdge) {
  return edge.startsWith("bottom");
}

function canResizeWidth(edge: ResizeEdge) {
  return (
    isLeftResizeEdge(edge) ||
    isRightResizeEdge(edge) ||
    edge === "left" ||
    edge === "right"
  );
}

function canResizeHeight(edge: ResizeEdge) {
  return (
    isTopResizeEdge(edge) ||
    isBottomResizeEdge(edge) ||
    edge === "top" ||
    edge === "bottom"
  );
}

function getResizeHandleAriaLabel(edge: ResizeEdge) {
  switch (edge) {
    case "top":
      return "Resize assistant from top edge";
    case "right":
      return "Resize assistant from right edge";
    case "bottom":
      return "Resize assistant from bottom edge";
    case "left":
      return "Resize assistant from left edge";
    case "top-left":
      return "Resize assistant from top left";
    case "top-right":
      return "Resize assistant from top right";
    case "bottom-left":
      return "Resize assistant from bottom left";
    case "bottom-right":
      return "Resize assistant from bottom right";
    default:
      return assertUnreachable(edge);
  }
}

function getViewportSize(): Size {
  if (typeof window === "undefined") {
    return { height: 0, width: 0 };
  }
  return { height: window.innerHeight, width: window.innerWidth };
}

function getViewportBounds(): Bounds {
  if (typeof window === "undefined") {
    return { height: 0, left: 0, top: 0, width: 0 };
  }

  const visualViewport = window.visualViewport;
  if (visualViewport) {
    return {
      height: visualViewport.height,
      left: visualViewport.offsetLeft,
      top: visualViewport.offsetTop,
      width: visualViewport.width,
    };
  }

  return {
    height: window.innerHeight,
    left: 0,
    top: 0,
    width: window.innerWidth,
  };
}

function getBoundaryBounds(
  boundary: HTMLElement | null | undefined
): Bounds | null {
  if (!boundary) return null;
  const rect = boundary.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return null;
  return {
    height: rect.height,
    left: rect.left,
    top: rect.top,
    width: rect.width,
  };
}

function getPanelBounds({
  boundary,
  layer,
  anchorToViewport = false,
}: {
  boundary: HTMLElement | null | undefined;
  layer: FloatingPanelLayer;
  anchorToViewport?: boolean;
}): Bounds {
  if (layer === "content" && !anchorToViewport) {
    return getBoundaryBounds(boundary) ?? getViewportBounds();
  }
  return getViewportBounds();
}

function areBoundsEqual(bounds: Bounds, nextBounds: Bounds) {
  return (
    bounds.height === nextBounds.height &&
    bounds.left === nextBounds.left &&
    bounds.top === nextBounds.top &&
    bounds.width === nextBounds.width
  );
}

function areGeometriesEqual(
  geometry: FloatingPanelGeometry,
  nextGeometry: FloatingPanelGeometry
) {
  return (
    geometry.height === nextGeometry.height &&
    geometry.width === nextGeometry.width &&
    geometry.x === nextGeometry.x &&
    geometry.y === nextGeometry.y
  );
}

function isFullscreenFloatingPanel() {
  const viewport = getViewportSize();
  return (
    viewport.width <= FULLSCREEN_BREAKPOINT_PX ||
    viewport.height <= FULLSCREEN_BREAKPOINT_PX
  );
}

function getGeometryLimits({
  bounds,
  minSize,
}: {
  bounds: Bounds;
  minSize: Size;
}): ResizeLimits {
  const maxWidth = Math.max(bounds.width - VIEWPORT_MARGIN_PX * 2, 0);
  const maxHeight = Math.max(
    bounds.height - VIEWPORT_VERTICAL_MARGIN_PX * 2,
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
  bounds,
  minSize,
  placement,
  size,
}: {
  bounds: Bounds;
  minSize: Size;
  placement: AgentFabPlacement;
  size: Size;
}): FloatingPanelGeometry {
  const limits = getGeometryLimits({ bounds, minSize });
  const width = clamp(size.width, limits.minWidth, limits.maxWidth);
  const height = clamp(size.height, limits.minHeight, limits.maxHeight);
  const x = placement.endsWith("end")
    ? bounds.left + bounds.width - width - VIEWPORT_MARGIN_PX
    : bounds.left + VIEWPORT_MARGIN_PX;
  const y = placement.startsWith("bottom")
    ? bounds.top + bounds.height - height - VIEWPORT_VERTICAL_MARGIN_PX
    : bounds.top + VIEWPORT_VERTICAL_MARGIN_PX;

  return clampGeometry({
    bounds,
    geometry: { height, width, x, y },
    minSize,
  });
}

function clampGeometry({
  bounds,
  geometry,
  minSize,
}: {
  bounds: Bounds;
  geometry: FloatingPanelGeometry;
  minSize: Size;
}): FloatingPanelGeometry {
  const limits = getGeometryLimits({ bounds, minSize });
  const width = clamp(geometry.width, limits.minWidth, limits.maxWidth);
  const height = clamp(geometry.height, limits.minHeight, limits.maxHeight);
  const minX = bounds.left + VIEWPORT_MARGIN_PX;
  const minY = bounds.top + VIEWPORT_VERTICAL_MARGIN_PX;
  const maxX = Math.max(
    bounds.left + bounds.width - width - VIEWPORT_MARGIN_PX,
    minX
  );
  const maxY = Math.max(
    bounds.top + bounds.height - height - VIEWPORT_VERTICAL_MARGIN_PX,
    minY
  );

  return {
    height,
    width,
    x: clamp(geometry.x, minX, maxX),
    y: clamp(geometry.y, minY, maxY),
  };
}

function getResizeBounds({
  bounds,
  edge,
  geometry,
  limits,
}: {
  bounds: Bounds;
  edge: ResizeEdge;
  geometry: FloatingPanelGeometry;
  limits: ResizeLimits;
}): Size {
  const maxWidth = isLeftResizeEdge(edge)
    ? geometry.x + geometry.width - bounds.left - VIEWPORT_MARGIN_PX
    : bounds.left + bounds.width - VIEWPORT_MARGIN_PX - geometry.x;
  const maxHeight = isTopResizeEdge(edge)
    ? geometry.y + geometry.height - bounds.top - VIEWPORT_VERTICAL_MARGIN_PX
    : bounds.top + bounds.height - VIEWPORT_VERTICAL_MARGIN_PX - geometry.y;

  return {
    height: Math.min(limits.maxHeight, maxHeight),
    width: Math.min(limits.maxWidth, maxWidth),
  };
}

function getResizeGeometryFromSize({
  bounds,
  edge,
  height,
  minSize,
  startGeometry,
  width,
}: {
  bounds: Bounds;
  edge: ResizeEdge;
  height: number;
  minSize: Size;
  startGeometry: FloatingPanelGeometry;
  width: number;
}): FloatingPanelGeometry {
  const isLeftEdge = isLeftResizeEdge(edge);
  const isTopEdge = isTopResizeEdge(edge);
  const nextWidth = canResizeWidth(edge) ? width : startGeometry.width;
  const nextHeight = canResizeHeight(edge) ? height : startGeometry.height;

  return clampGeometry({
    bounds,
    geometry: {
      ...startGeometry,
      height: nextHeight,
      width: nextWidth,
      x: isLeftEdge
        ? startGeometry.x + startGeometry.width - nextWidth
        : startGeometry.x,
      y: isTopEdge
        ? startGeometry.y + startGeometry.height - nextHeight
        : startGeometry.y,
    },
    minSize,
  });
}

function getKeyboardResizeDelta({
  edge,
  key,
}: {
  edge: ResizeEdge;
  key: string;
}): { height: number; width: number } | null {
  const horizontalStep = isLeftResizeEdge(edge)
    ? -KEYBOARD_RESIZE_STEP_PX
    : KEYBOARD_RESIZE_STEP_PX;
  const verticalStep = isTopResizeEdge(edge)
    ? -KEYBOARD_RESIZE_STEP_PX
    : KEYBOARD_RESIZE_STEP_PX;

  switch (key) {
    case "ArrowLeft":
      return canResizeWidth(edge)
        ? { height: 0, width: -horizontalStep }
        : null;
    case "ArrowRight":
      return canResizeWidth(edge) ? { height: 0, width: horizontalStep } : null;
    case "ArrowDown":
      return canResizeHeight(edge) ? { height: verticalStep, width: 0 } : null;
    case "ArrowUp":
      return canResizeHeight(edge) ? { height: -verticalStep, width: 0 } : null;
    default:
      return null;
  }
}

function getResizedGeometry({
  bounds,
  minSize,
  pointer,
  session,
}: {
  bounds: Bounds;
  minSize: Size;
  pointer: Point;
  session: ResizeSession;
}): FloatingPanelGeometry {
  const startGeometry = session.startGeometry;
  const limits = getGeometryLimits({ bounds, minSize });
  const resizeBounds = getResizeBounds({
    bounds,
    edge: session.edge,
    geometry: startGeometry,
    limits,
  });
  const width = clamp(
    canResizeWidth(session.edge)
      ? isLeftResizeEdge(session.edge)
        ? startGeometry.x + startGeometry.width - pointer.x
        : pointer.x - startGeometry.x
      : startGeometry.width,
    limits.minWidth,
    resizeBounds.width
  );
  const height = clamp(
    canResizeHeight(session.edge)
      ? isTopResizeEdge(session.edge)
        ? startGeometry.y + startGeometry.height - pointer.y
        : pointer.y - startGeometry.y
      : startGeometry.height,
    limits.minHeight,
    resizeBounds.height
  );

  return getResizeGeometryFromSize({
    bounds,
    edge: session.edge,
    height,
    minSize,
    startGeometry,
    width,
  });
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
  --resizable-floating-panel-viewport-margin: var(--global-dimension-size-400);

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

  @media (max-width: ${FULLSCREEN_BREAKPOINT_PX}px),
    (max-height: ${FULLSCREEN_BREAKPOINT_PX}px) {
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
  }
`;

const resizeHandleCSS = css`
  position: fixed;
  z-index: ${NON_MODAL_FLOATING_Z_INDEX + 1};
  border: none;
  outline: none;
  padding: 0;
  background: transparent;
  touch-action: none;

  &:focus-visible {
    outline: var(--focus-ring-thickness) solid var(--focus-ring-color);
    outline-offset: calc(-1 * var(--focus-ring-thickness));
  }

  &[data-layer="modal"] {
    z-index: ${MODAL_FLOATING_UI_Z_INDEX + 1};
  }

  &[data-edge] {
    width: ${RESIZE_CORNER_HANDLE_SIZE_PX}px;
    height: ${RESIZE_CORNER_HANDLE_SIZE_PX}px;
  }

  &[data-edge="top"] {
    top: var(--resizable-floating-panel-y);
    left: calc(
      var(--resizable-floating-panel-x) + ${RESIZE_CORNER_HANDLE_SIZE_PX}px
    );
    width: calc(
      var(--resizable-floating-panel-width) -
        ${RESIZE_CORNER_HANDLE_SIZE_PX * 2}px
    );
    height: ${RESIZE_EDGE_HANDLE_THICKNESS_PX}px;
    cursor: ns-resize;
  }

  &[data-edge="right"] {
    top: calc(
      var(--resizable-floating-panel-y) + ${RESIZE_CORNER_HANDLE_SIZE_PX}px
    );
    left: calc(
      var(--resizable-floating-panel-x) +
        var(--resizable-floating-panel-width) -
        ${RESIZE_EDGE_HANDLE_THICKNESS_PX}px
    );
    width: ${RESIZE_EDGE_HANDLE_THICKNESS_PX}px;
    height: calc(
      var(--resizable-floating-panel-height) -
        ${RESIZE_CORNER_HANDLE_SIZE_PX * 2}px
    );
    cursor: ew-resize;
  }

  &[data-edge="bottom"] {
    top: calc(
      var(--resizable-floating-panel-y) +
        var(--resizable-floating-panel-height) -
        ${RESIZE_EDGE_HANDLE_THICKNESS_PX}px
    );
    left: calc(
      var(--resizable-floating-panel-x) + ${RESIZE_CORNER_HANDLE_SIZE_PX}px
    );
    width: calc(
      var(--resizable-floating-panel-width) -
        ${RESIZE_CORNER_HANDLE_SIZE_PX * 2}px
    );
    height: ${RESIZE_EDGE_HANDLE_THICKNESS_PX}px;
    cursor: ns-resize;
  }

  &[data-edge="left"] {
    top: calc(
      var(--resizable-floating-panel-y) + ${RESIZE_CORNER_HANDLE_SIZE_PX}px
    );
    left: var(--resizable-floating-panel-x);
    width: ${RESIZE_EDGE_HANDLE_THICKNESS_PX}px;
    height: calc(
      var(--resizable-floating-panel-height) -
        ${RESIZE_CORNER_HANDLE_SIZE_PX * 2}px
    );
    cursor: ew-resize;
  }

  &[data-edge="top-left"] {
    top: var(--resizable-floating-panel-y);
    left: var(--resizable-floating-panel-x);
    cursor: nwse-resize;
  }

  &[data-edge="top-right"] {
    top: var(--resizable-floating-panel-y);
    left: calc(
      var(--resizable-floating-panel-x) +
        var(--resizable-floating-panel-width) -
        ${RESIZE_CORNER_HANDLE_SIZE_PX}px
    );
    cursor: nesw-resize;
  }

  &[data-edge="bottom-left"] {
    top: calc(
      var(--resizable-floating-panel-y) +
        var(--resizable-floating-panel-height) -
        ${RESIZE_CORNER_HANDLE_SIZE_PX}px
    );
    left: var(--resizable-floating-panel-x);
    cursor: nesw-resize;
  }

  &[data-edge="bottom-right"] {
    top: calc(
      var(--resizable-floating-panel-y) +
        var(--resizable-floating-panel-height) -
        ${RESIZE_CORNER_HANDLE_SIZE_PX}px
    );
    left: calc(
      var(--resizable-floating-panel-x) +
        var(--resizable-floating-panel-width) -
        ${RESIZE_CORNER_HANDLE_SIZE_PX}px
    );
    cursor: nwse-resize;
  }

  @media (max-width: ${FULLSCREEN_BREAKPOINT_PX}px),
    (max-height: ${FULLSCREEN_BREAKPOINT_PX}px) {
    display: none;
  }
`;

export function ResizableFloatingPanel({
  boundaryRef,
  children,
  layer = "content",
  minSize,
  placement,
  size,
  onSizeChange,
  anchorToViewport = false,
}: ResizableFloatingPanelProps) {
  const panelId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const resizeSessionRef = useRef<ResizeSession | null>(null);
  const moveSessionRef = useRef<MoveSession | null>(null);
  const pendingGeometryRef = useRef<FloatingPanelGeometry | null>(null);
  const latestGeometryRef = useRef<FloatingPanelGeometry | null>(null);
  const animationFrameIdRef = useRef<number | null>(null);
  const previousLayerRef = useRef(layer);
  const previousPlacementRef = useRef(placement);
  // Until the user drags or resizes the panel it stays "pristine" and tracks
  // the default corner as the boundary changes. This keeps the panel pinned to
  // the FAB's corner when it first floats out of a docked layout, where the
  // boundary is briefly mid-reflow (still reserving the docked panel's width)
  // and would otherwise strand the panel in the middle of the screen.
  const hasUserPositionedRef = useRef(false);
  const [resizingEdge, setResizingEdge] = useState<ResizeEdge | null>(null);
  const [isMoving, setIsMoving] = useState(false);
  const [isResizeHandleHovered, setIsResizeHandleHovered] = useState(false);
  const [resolvedBoundary, setResolvedBoundary] = useState<HTMLElement | null>(
    () => boundaryRef?.current ?? null
  );
  const [currentBounds, setCurrentBounds] = useState(() =>
    getPanelBounds({
      boundary: boundaryRef?.current ?? null,
      layer,
      anchorToViewport,
    })
  );
  const [currentGeometry, setCurrentGeometry] = useState(() =>
    getDefaultGeometry({
      bounds: getPanelBounds({
        boundary: boundaryRef?.current ?? null,
        layer,
        anchorToViewport,
      }),
      minSize,
      placement,
      size,
    })
  );
  useModalFloatingLayerInteractivity(panelRef, layer === "modal");

  const resizeLimits = getGeometryLimits({ bounds: currentBounds, minSize });
  const displayedGeometry = clampGeometry({
    bounds: currentBounds,
    geometry: currentGeometry,
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
    hasUserPositionedRef.current = true;
    const clampedGeometry = clampGeometry({
      bounds: currentBounds,
      geometry: nextGeometry,
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
    hasUserPositionedRef.current = true;
    const clampedGeometry = clampGeometry({
      bounds: currentBounds,
      geometry: nextGeometry,
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
      edge,
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
        bounds: currentBounds,
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
        bounds: currentBounds,
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
        bounds: currentBounds,
        geometry: {
          ...session.startGeometry,
          x: session.startGeometry.x + event.clientX - session.startPointer.x,
          y: session.startGeometry.y + event.clientY - session.startPointer.y,
        },
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
        bounds: currentBounds,
        geometry: {
          ...session.startGeometry,
          x: session.startGeometry.x + event.clientX - session.startPointer.x,
          y: session.startGeometry.y + event.clientY - session.startPointer.y,
        },
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
  const handleResizeKeyDown = (
    event: ReactKeyboardEvent<HTMLDivElement>,
    edge: ResizeEdge
  ) => {
    const isHome = event.key === "Home";
    const isEnd = event.key === "End";
    const delta =
      isHome || isEnd ? null : getKeyboardResizeDelta({ edge, key: event.key });
    if (!isHome && !isEnd && delta == null) return;

    event.preventDefault();

    const resizeBounds = getResizeBounds({
      bounds: currentBounds,
      edge,
      geometry: displayedGeometry,
      limits: resizeLimits,
    });
    const targetWidth = isHome
      ? resizeLimits.minWidth
      : isEnd
        ? resizeBounds.width
        : displayedGeometry.width + (delta?.width ?? 0);
    const targetHeight = isHome
      ? resizeLimits.minHeight
      : isEnd
        ? resizeBounds.height
        : displayedGeometry.height + (delta?.height ?? 0);
    const nextWidth = clamp(
      targetWidth,
      resizeLimits.minWidth,
      Math.min(resizeLimits.maxWidth, resizeBounds.width)
    );
    const nextHeight = clamp(
      targetHeight,
      resizeLimits.minHeight,
      Math.min(resizeLimits.maxHeight, resizeBounds.height)
    );

    commitGeometry({
      nextGeometry: getResizeGeometryFromSize({
        bounds: currentBounds,
        edge,
        height: nextHeight,
        minSize,
        startGeometry: displayedGeometry,
        width: nextWidth,
      }),
      shouldCommitSize: true,
    });
  };

  useLayoutEffect(() => {
    if (layer !== "content") {
      setResolvedBoundary(null);
      return undefined;
    }

    let animationFrameId: number | null = null;
    const syncBoundaryElement = () => {
      const nextBoundary = boundaryRef?.current ?? null;
      setResolvedBoundary((currentBoundary) =>
        currentBoundary === nextBoundary ? currentBoundary : nextBoundary
      );

      if (boundaryRef && !nextBoundary) {
        animationFrameId = window.requestAnimationFrame(syncBoundaryElement);
      }
    };

    syncBoundaryElement();

    return () => {
      if (animationFrameId != null) {
        window.cancelAnimationFrame(animationFrameId);
      }
    };
  }, [boundaryRef, layer]);

  useLayoutEffect(() => {
    const syncPanelBounds = () => {
      const nextBounds = getPanelBounds({
        boundary: resolvedBoundary,
        layer,
        anchorToViewport,
      });
      setCurrentBounds((bounds) =>
        areBoundsEqual(bounds, nextBounds) ? bounds : nextBounds
      );
      setCurrentGeometry((geometry) => {
        // While pristine, re-pin to the default corner for the new bounds so a
        // mid-reflow boundary (e.g. just after undocking) can't leave the panel
        // stranded. Once the user has moved or resized it, only clamp so their
        // chosen position is preserved.
        const nextGeometry = hasUserPositionedRef.current
          ? clampGeometry({ bounds: nextBounds, geometry, minSize })
          : getDefaultGeometry({
              bounds: nextBounds,
              minSize,
              placement,
              size: { height: geometry.height, width: geometry.width },
            });
        latestGeometryRef.current = nextGeometry;
        return areGeometriesEqual(geometry, nextGeometry)
          ? geometry
          : nextGeometry;
      });
    };

    syncPanelBounds();

    const observer =
      layer === "content" &&
      !anchorToViewport &&
      resolvedBoundary &&
      typeof ResizeObserver === "function"
        ? new ResizeObserver(syncPanelBounds)
        : null;
    if (resolvedBoundary && observer) {
      observer.observe(resolvedBoundary);
    }
    window.addEventListener("resize", syncPanelBounds);
    window.visualViewport?.addEventListener("resize", syncPanelBounds);
    window.visualViewport?.addEventListener("scroll", syncPanelBounds);

    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", syncPanelBounds);
      window.visualViewport?.removeEventListener("resize", syncPanelBounds);
      window.visualViewport?.removeEventListener("scroll", syncPanelBounds);
    };
  }, [anchorToViewport, layer, minSize, placement, resolvedBoundary]);

  useEffect(() => {
    setCurrentGeometry((geometry) =>
      clampGeometry({
        bounds: currentBounds,
        geometry: {
          ...geometry,
          height: size.height,
          width: size.width,
        },
        minSize,
      })
    );
  }, [currentBounds, minSize, size]);

  useEffect(() => {
    const hasLayerChanged = previousLayerRef.current !== layer;
    const hasPlacementChanged = previousPlacementRef.current !== placement;
    if (!hasLayerChanged && !hasPlacementChanged) {
      return;
    }

    previousLayerRef.current = layer;
    previousPlacementRef.current = placement;
    setCurrentGeometry((geometry) =>
      getDefaultGeometry({
        bounds: currentBounds,
        minSize,
        placement,
        size: {
          height: geometry.height,
          width: geometry.width,
        },
      })
    );
  }, [currentBounds, layer, minSize, placement]);

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

  const floatingPanelStyle: CSSProperties & Record<`--${string}`, string> = {
    "--resizable-floating-panel-height": `${displayedGeometry.height}px`,
    "--resizable-floating-panel-min-height": `${minSize.height}px`,
    "--resizable-floating-panel-min-width": `${minSize.width}px`,
    "--resizable-floating-panel-width": `${displayedGeometry.width}px`,
    "--resizable-floating-panel-x": `${displayedGeometry.x}px`,
    "--resizable-floating-panel-y": `${displayedGeometry.y}px`,
  };

  return (
    <>
      {RESIZE_EDGES.map((edge) => (
        <div
          key={edge}
          role="separator"
          tabIndex={0}
          aria-controls={panelId}
          aria-label={getResizeHandleAriaLabel(edge)}
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
          onKeyDown={(event) => handleResizeKeyDown(event, edge)}
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
    </>
  );
}
