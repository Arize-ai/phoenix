import { css } from "@emotion/react";
import type {
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
  ReactNode,
  RefObject,
  TransitionEvent as ReactTransitionEvent,
} from "react";
import { useLayoutEffect, useRef, useState } from "react";

import type { AgentFabPlacement } from "@phoenix/store/agentStore";

import {
  AGENT_FAB_INSET,
  AGENT_FAB_RESTING_SIZE,
  clampAgentFabPosition,
  getAgentFabPinnedPosition,
  getNearestAgentFabPlacement,
  type AgentFabBounds,
  type AgentFabPoint,
  type AgentFabSize,
} from "./agentFabPositioning";

const DRAG_START_THRESHOLD_PX = 4;
const SNAP_TRANSITION = "transform 180ms cubic-bezier(0.2, 0.9, 0.2, 1)";

const positionerCSS = css`
  position: fixed;
  top: 0;
  left: 0;
  z-index: 1000;
  cursor: pointer;
  touch-action: none;
  transform: translate3d(0, 0, 0);
  visibility: hidden;
  will-change: transform;

  &[data-ready="true"] {
    visibility: visible;
  }

  &[data-dragging="true"],
  &[data-dragging="true"] * {
    cursor: grabbing;
  }
`;

type DragSession = {
  bounds: AgentFabBounds;
  hasPointerCapture: boolean;
  offset: AgentFabPoint;
  pointerId: number;
  size: AgentFabSize;
  startPointer: AgentFabPoint;
};

export type AgentFabPositionerProps = {
  boundaryRef?: RefObject<HTMLElement | null>;
  children: ReactNode;
  placement: AgentFabPlacement;
  size?: AgentFabSize;
  onPlacementChange: (placement: AgentFabPlacement) => void;
};

function getViewportBounds(): AgentFabBounds {
  const visualViewport = window.visualViewport;
  if (visualViewport) {
    return {
      left: visualViewport.offsetLeft,
      top: visualViewport.offsetTop,
      width: visualViewport.width,
      height: visualViewport.height,
    };
  }

  return {
    left: 0,
    top: 0,
    width: window.innerWidth,
    height: window.innerHeight,
  };
}

function getRectBounds(rect: DOMRect): AgentFabBounds {
  return {
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height,
  };
}

function requestFrame(callback: FrameRequestCallback): number {
  if (typeof window.requestAnimationFrame === "function") {
    return window.requestAnimationFrame(callback);
  }
  return window.setTimeout(() => callback(performance.now()), 16);
}

function cancelFrame(frameId: number) {
  if (typeof window.cancelAnimationFrame === "function") {
    window.cancelAnimationFrame(frameId);
    return;
  }
  window.clearTimeout(frameId);
}

function getBoundaryBounds(boundary: HTMLElement | null | undefined) {
  if (boundary) {
    const rect = boundary.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      return getRectBounds(rect);
    }
  }
  return null;
}

function getPositioningBounds({
  boundary,
  requiresBoundary,
}: {
  boundary: HTMLElement | null | undefined;
  requiresBoundary: boolean;
}) {
  return (
    getBoundaryBounds(boundary) ??
    (requiresBoundary ? null : getViewportBounds())
  );
}

function getElementSize({
  element,
  size,
}: {
  element: HTMLElement | null;
  size?: AgentFabSize;
}): AgentFabSize {
  if (size) {
    return size;
  }

  const rect = element?.getBoundingClientRect();
  if (rect && rect.width > 0 && rect.height > 0) {
    return {
      width: rect.width,
      height: rect.height,
    };
  }

  return AGENT_FAB_RESTING_SIZE;
}

function applyElementPosition({
  element,
  point,
}: {
  element: HTMLElement | null;
  point: AgentFabPoint;
}) {
  if (!element) return;
  element.style.transform = `translate3d(${point.x}px, ${point.y}px, 0)`;
  element.dataset.ready = "true";
}

function applyElementPinnedPosition({
  boundary,
  element,
  placement,
  requiresBoundary,
  size,
}: {
  boundary: HTMLElement | null | undefined;
  element: HTMLElement | null;
  placement: AgentFabPlacement;
  requiresBoundary: boolean;
  size?: AgentFabSize;
}): boolean {
  const bounds = getPositioningBounds({ boundary, requiresBoundary });
  if (!bounds) {
    delete element?.dataset.ready;
    return false;
  }

  applyElementPosition({
    element,
    point: getAgentFabPinnedPosition({
      placement,
      bounds,
      size: getElementSize({ element, size }),
      inset: AGENT_FAB_INSET,
    }),
  });
  return true;
}

export function AgentFabPositioner({
  boundaryRef,
  children,
  placement,
  size,
  onPlacementChange,
}: AgentFabPositionerProps) {
  const positionerRef = useRef<HTMLDivElement>(null);
  const dragSessionRef = useRef<DragSession | null>(null);
  const frameIdRef = useRef<number | null>(null);
  const pendingPointerRef = useRef<AgentFabPoint | null>(null);
  const latestDragPositionRef = useRef<AgentFabPoint | null>(null);
  const hasDraggedRef = useRef(false);
  const suppressClickRef = useRef(false);
  const suppressClickResetIdRef = useRef<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const requiresBoundary = Boolean(boundaryRef);

  const scheduleSuppressClickReset = () => {
    if (suppressClickResetIdRef.current != null) {
      window.clearTimeout(suppressClickResetIdRef.current);
    }
    suppressClickResetIdRef.current = window.setTimeout(() => {
      suppressClickRef.current = false;
      suppressClickResetIdRef.current = null;
    }, 0);
  };

  const getBounds = (): AgentFabBounds => {
    return (
      getPositioningBounds({
        boundary: boundaryRef?.current,
        requiresBoundary,
      }) ?? getViewportBounds()
    );
  };

  const getSize = (): AgentFabSize => {
    return getElementSize({ element: positionerRef.current, size });
  };

  const applyPosition = (point: AgentFabPoint) => {
    applyElementPosition({ element: positionerRef.current, point });
  };

  const getDragPosition = ({
    pointer,
    session,
  }: {
    pointer: AgentFabPoint;
    session: DragSession;
  }): AgentFabPoint =>
    clampAgentFabPosition({
      point: {
        x: pointer.x - session.offset.x,
        y: pointer.y - session.offset.y,
      },
      bounds: session.bounds,
      size: session.size,
      inset: AGENT_FAB_INSET,
    });

  const flushPendingDragPosition = () => {
    frameIdRef.current = null;
    const session = dragSessionRef.current;
    const pointer = pendingPointerRef.current;
    if (!session || !pointer) return;
    pendingPointerRef.current = null;
    const nextPosition = getDragPosition({ pointer, session });
    latestDragPositionRef.current = nextPosition;
    applyPosition(nextPosition);
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;

    const positioner = positionerRef.current;
    if (!positioner) return;

    const rect = positioner.getBoundingClientRect();
    const nextSize =
      rect.width > 0 && rect.height > 0
        ? { width: rect.width, height: rect.height }
        : getSize();
    const pointer = { x: event.clientX, y: event.clientY };

    dragSessionRef.current = {
      bounds: getBounds(),
      hasPointerCapture: false,
      offset: {
        x: pointer.x - rect.left,
        y: pointer.y - rect.top,
      },
      pointerId: event.pointerId,
      size: nextSize,
      startPointer: pointer,
    };
    latestDragPositionRef.current = null;
    pendingPointerRef.current = null;
    hasDraggedRef.current = false;
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const session = dragSessionRef.current;
    if (!session) return;

    const pointer = { x: event.clientX, y: event.clientY };
    const distance =
      (pointer.x - session.startPointer.x) ** 2 +
      (pointer.y - session.startPointer.y) ** 2;

    if (!hasDraggedRef.current) {
      if (distance < DRAG_START_THRESHOLD_PX ** 2) {
        return;
      }
      hasDraggedRef.current = true;
      session.hasPointerCapture = true;
      event.currentTarget.setPointerCapture(session.pointerId);
      positionerRef.current?.style.setProperty("transition", "none");
      setIsDragging(true);
    }

    event.preventDefault();
    pendingPointerRef.current = pointer;

    if (frameIdRef.current == null) {
      frameIdRef.current = requestFrame(flushPendingDragPosition);
    }
  };

  const finishDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const session = dragSessionRef.current;
    if (!session) return;

    if (frameIdRef.current != null) {
      cancelFrame(frameIdRef.current);
      frameIdRef.current = null;
    }

    if (pendingPointerRef.current) {
      const nextPosition = getDragPosition({
        pointer: pendingPointerRef.current,
        session,
      });
      pendingPointerRef.current = null;
      latestDragPositionRef.current = nextPosition;
      applyPosition(nextPosition);
    }

    dragSessionRef.current = null;
    setIsDragging(false);

    if (
      session.hasPointerCapture &&
      event.currentTarget.hasPointerCapture(session.pointerId)
    ) {
      event.currentTarget.releasePointerCapture(session.pointerId);
    }

    if (!hasDraggedRef.current) {
      positionerRef.current?.style.removeProperty("transition");
      return;
    }

    suppressClickRef.current = true;
    scheduleSuppressClickReset();
    const droppedPosition =
      latestDragPositionRef.current ??
      getAgentFabPinnedPosition({
        placement,
        bounds: session.bounds,
        size: session.size,
        inset: AGENT_FAB_INSET,
      });
    const nextPlacement = getNearestAgentFabPlacement({
      point: droppedPosition,
      bounds: session.bounds,
      size: session.size,
      inset: AGENT_FAB_INSET,
    });

    if (positionerRef.current) {
      positionerRef.current.style.transition = SNAP_TRANSITION;
    }

    applyPosition(
      getAgentFabPinnedPosition({
        placement: nextPlacement,
        bounds: session.bounds,
        size: session.size,
        inset: AGENT_FAB_INSET,
      })
    );

    if (nextPlacement !== placement) {
      onPlacementChange(nextPlacement);
    }
  };

  const handleClickCapture = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (!suppressClickRef.current) return;
    suppressClickRef.current = false;
    if (suppressClickResetIdRef.current != null) {
      window.clearTimeout(suppressClickResetIdRef.current);
      suppressClickResetIdRef.current = null;
    }
    event.preventDefault();
    event.stopPropagation();
  };

  const handleTransitionEnd = (event: ReactTransitionEvent<HTMLDivElement>) => {
    if (event.propertyName === "transform" && !dragSessionRef.current) {
      event.currentTarget.style.removeProperty("transition");
    }
  };

  useLayoutEffect(() => {
    if (!dragSessionRef.current) {
      applyElementPinnedPosition({
        boundary: boundaryRef?.current,
        element: positionerRef.current,
        placement,
        requiresBoundary,
        size,
      });
    }
  }, [boundaryRef, placement, requiresBoundary, size]);

  useLayoutEffect(() => {
    const syncPinnedPosition = () => {
      if (!dragSessionRef.current) {
        applyElementPinnedPosition({
          boundary: boundaryRef?.current,
          element: positionerRef.current,
          placement,
          requiresBoundary,
          size,
        });
      }
    };
    const boundary = boundaryRef?.current;
    const observer =
      boundary && typeof ResizeObserver === "function"
        ? new ResizeObserver(syncPinnedPosition)
        : null;

    if (boundary && observer) {
      observer.observe(boundary);
    }
    const syncFrameId = requestFrame(syncPinnedPosition);
    window.addEventListener("resize", syncPinnedPosition);
    window.visualViewport?.addEventListener("resize", syncPinnedPosition);
    window.visualViewport?.addEventListener("scroll", syncPinnedPosition);

    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", syncPinnedPosition);
      window.visualViewport?.removeEventListener("resize", syncPinnedPosition);
      window.visualViewport?.removeEventListener("scroll", syncPinnedPosition);
      cancelFrame(syncFrameId);

      if (frameIdRef.current != null) {
        cancelFrame(frameIdRef.current);
        frameIdRef.current = null;
      }
      if (suppressClickResetIdRef.current != null) {
        window.clearTimeout(suppressClickResetIdRef.current);
        suppressClickResetIdRef.current = null;
      }
    };
  }, [boundaryRef, placement, requiresBoundary, size]);

  return (
    <div
      className="agent-chat-widget-positioner"
      css={positionerCSS}
      data-dragging={isDragging ? "true" : undefined}
      data-placement={placement}
      ref={positionerRef}
      onClickCapture={handleClickCapture}
      onPointerCancel={finishDrag}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={finishDrag}
      onTransitionEnd={handleTransitionEnd}
    >
      {children}
    </div>
  );
}
