import { css } from "@emotion/react";
import type {
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
  ReactNode,
  RefObject,
  SyntheticEvent as ReactSyntheticEvent,
  TransitionEvent as ReactTransitionEvent,
} from "react";
import { useLayoutEffect, useRef, useState } from "react";
import invariant from "tiny-invariant";

import {
  MODAL_FLOATING_UI_Z_INDEX,
  NON_MODAL_FLOATING_Z_INDEX,
} from "@phoenix/components/core/zIndex";
import type { AgentFabPlacement } from "@phoenix/store/agentStore";
import type { Bounds, Point, Size } from "@phoenix/types/geometry";

import {
  clampFabPosition,
  FAB_RESTING_SIZE,
  getFabPinnedPosition,
  getNearestFabPlacement,
} from "./agentFabPositioning";
import { useModalFloatingLayerInteractivity } from "./useModalFloatingLayerInteractivity";

// Number of pixels the pointer must travel after pointerdown before we treat
// the gesture as a drag instead of a click. Compared as squared distance to
// avoid the square root in the hot path.
const DRAG_START_THRESHOLD_PX = 4;

// Easing curve and duration for the snap-to-corner animation after a drop.
const SNAP_DURATION_MS = 180;
const SNAP_EASING = "cubic-bezier(0.2, 0.9, 0.2, 1)";
const SNAP_TRANSITION = `transform ${SNAP_DURATION_MS}ms ${SNAP_EASING}`;

// MouseEvent / PointerEvent `button` value for the primary (typically left)
// button. The FAB only responds to primary-button gestures.
const PRIMARY_POINTER_BUTTON = 0;

const positionerCSS = css`
  position: fixed;
  top: 0;
  left: 0;
  z-index: ${NON_MODAL_FLOATING_Z_INDEX};
  cursor: pointer;
  touch-action: none;
  transform: translate3d(0, 0, 0);
  visibility: hidden;
  will-change: transform;

  &[data-ready="true"] {
    visibility: visible;
  }

  &[data-hidden="true"] {
    pointer-events: none;
    visibility: hidden;
  }

  &[data-activation-suppressed="true"] {
    pointer-events: none;
  }

  &[data-dragging="true"],
  &[data-dragging="true"] * {
    cursor: grabbing;
  }

  &[data-layer="modal"] {
    z-index: ${MODAL_FLOATING_UI_Z_INDEX};
  }
`;

type DragSession = {
  bounds: Bounds;
  hasPointerCapture: boolean;
  offset: Point;
  pointerId: number;
  size: Size;
  startPointer: Point;
};

type FinishDragSessionOptions = {
  activateOnClick: boolean;
  point?: Point;
  releaseTarget?: HTMLElement | null;
};

export type AgentFabPositionerProps = {
  boundaryRef?: RefObject<HTMLElement | null>;
  children: ReactNode;
  isHidden?: boolean;
  layer?: "content" | "modal";
  placement: AgentFabPlacement;
  size?: Size;
  onActivate?: () => void;
  onPlacementChange: (placement: AgentFabPlacement) => void;
};

function getViewportBounds(): Bounds {
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

function getBoundaryBounds(
  boundary: HTMLElement | null | undefined
): Bounds | null {
  if (!boundary) return null;
  const rect = boundary.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return null;
  return {
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height,
  };
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
  size?: Size;
}): Size {
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

  // Element hasn't been measured yet (first paint, or hidden). Fall back to
  // the resting size so positioning math has stable inputs; the next layout
  // effect will re-run with the real measurement.
  return FAB_RESTING_SIZE;
}

function applyElementPosition({
  element,
  point,
}: {
  element: HTMLElement | null;
  point: Point;
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
  size?: Size;
}) {
  const bounds = getPositioningBounds({ boundary, requiresBoundary });
  if (!bounds) {
    // Hide the positioner until a usable boundary is available so the user
    // never sees the FAB at a stale or default location.
    delete element?.dataset.ready;
    return;
  }

  applyElementPosition({
    element,
    point: getFabPinnedPosition({
      placement,
      bounds,
      size: getElementSize({ element, size }),
    }),
  });
}

export function AgentFabPositioner({
  boundaryRef,
  children,
  isHidden = false,
  layer = "content",
  placement,
  size,
  onActivate,
  onPlacementChange,
}: AgentFabPositionerProps) {
  const positionerRef = useRef<HTMLDivElement>(null);
  const dragSessionRef = useRef<DragSession | null>(null);
  const animationFrameIdRef = useRef<number | null>(null);
  const pendingPointerRef = useRef<Point | null>(null);
  const lastDragPositionRef = useRef<Point | null>(null);
  const finishDragSessionRef = useRef<
    (options: FinishDragSessionOptions) => void
  >(() => {});
  const hasDraggedRef = useRef(false);
  const suppressNextClickRef = useRef(false);
  const suppressClickResetTimeoutIdRef = useRef<number | null>(null);
  const suppressActivationRef = useRef(false);
  const suppressActivationTimeoutIdRef = useRef<number | null>(null);
  const previousLayerRef = useRef(layer);
  const [isDragging, setIsDragging] = useState(false);
  const requiresBoundary = Boolean(boundaryRef);
  const [resolvedBoundary, setResolvedBoundary] = useState<HTMLElement | null>(
    () => boundaryRef?.current ?? null
  );
  useModalFloatingLayerInteractivity(positionerRef, layer === "modal");

  // After a drag, an unwanted `click` event can still fire on pointerup. We
  // swallow exactly one click immediately following a drag. A zero-delay
  // timeout clears the flag on the next task — after the click has had a
  // chance to fire — so a later real click is not swallowed.
  const scheduleSuppressClickReset = () => {
    if (suppressClickResetTimeoutIdRef.current != null) {
      window.clearTimeout(suppressClickResetTimeoutIdRef.current);
    }
    suppressClickResetTimeoutIdRef.current = window.setTimeout(() => {
      suppressNextClickRef.current = false;
      suppressClickResetTimeoutIdRef.current = null;
    }, 0);
  };

  const getBounds = (): Bounds => {
    return (
      getPositioningBounds({
        boundary: resolvedBoundary,
        requiresBoundary,
      }) ?? getViewportBounds()
    );
  };

  const getSize = (): Size => {
    return getElementSize({ element: positionerRef.current, size });
  };

  const applyPosition = (point: Point) => {
    applyElementPosition({ element: positionerRef.current, point });
  };

  const getDragPosition = ({
    pointer,
    session,
  }: {
    pointer: Point;
    session: DragSession;
  }): Point =>
    clampFabPosition({
      point: {
        x: pointer.x - session.offset.x,
        y: pointer.y - session.offset.y,
      },
      bounds: session.bounds,
      size: session.size,
    });

  const snapTo = ({
    placement: targetPlacement,
    session,
  }: {
    placement: AgentFabPlacement;
    session: DragSession;
  }) => {
    if (positionerRef.current) {
      positionerRef.current.style.transition = SNAP_TRANSITION;
    }
    applyPosition(
      getFabPinnedPosition({
        placement: targetPlacement,
        bounds: session.bounds,
        size: session.size,
      })
    );
  };

  const flushPendingDragPosition = () => {
    animationFrameIdRef.current = null;
    const session = dragSessionRef.current;
    const pointer = pendingPointerRef.current;
    if (!session || !pointer) return;
    pendingPointerRef.current = null;
    const nextPosition = getDragPosition({ pointer, session });
    lastDragPositionRef.current = nextPosition;
    applyPosition(nextPosition);
  };

  finishDragSessionRef.current = ({
    activateOnClick,
    point,
    releaseTarget,
  }: FinishDragSessionOptions) => {
    const session = dragSessionRef.current;
    if (!session) return;

    if (animationFrameIdRef.current != null) {
      window.cancelAnimationFrame(animationFrameIdRef.current);
      animationFrameIdRef.current = null;
    }

    const finalPointer =
      pendingPointerRef.current ?? (hasDraggedRef.current ? point : undefined);
    if (finalPointer) {
      const nextPosition = getDragPosition({
        pointer: finalPointer,
        session,
      });
      pendingPointerRef.current = null;
      lastDragPositionRef.current = nextPosition;
      applyPosition(nextPosition);
    }

    dragSessionRef.current = null;
    setIsDragging(false);

    if (
      session.hasPointerCapture &&
      releaseTarget?.hasPointerCapture(session.pointerId)
    ) {
      releaseTarget.releasePointerCapture(session.pointerId);
    }

    if (!hasDraggedRef.current) {
      positionerRef.current?.style.removeProperty("transition");
      if (activateOnClick) {
        onActivate?.();
      }
      return;
    }

    suppressNextClickRef.current = true;
    scheduleSuppressClickReset();

    const dropPosition = lastDragPositionRef.current;
    invariant(dropPosition, "drag finished without a recorded position");
    const nextPlacement = getNearestFabPlacement({
      point: dropPosition,
      bounds: session.bounds,
      size: session.size,
    });

    snapTo({ placement: nextPlacement, session });

    if (nextPlacement !== placement) {
      onPlacementChange(nextPlacement);
    }
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== PRIMARY_POINTER_BUTTON) return;

    if (suppressActivationRef.current) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    const positioner = positionerRef.current;
    if (!positioner) return;

    const rect = positioner.getBoundingClientRect();
    const measuredSize =
      rect.width > 0 && rect.height > 0
        ? { width: rect.width, height: rect.height }
        : getSize();
    const pointer = { x: event.clientX, y: event.clientY };

    const session: DragSession = {
      bounds: getBounds(),
      hasPointerCapture: false,
      offset: {
        x: pointer.x - rect.left,
        y: pointer.y - rect.top,
      },
      pointerId: event.pointerId,
      size: measuredSize,
      startPointer: pointer,
    };
    // Capture immediately so touch drags stay connected before the movement
    // threshold is crossed, even when the trigger child releases implicit
    // pointer capture.
    event.currentTarget.setPointerCapture(session.pointerId);
    session.hasPointerCapture = true;
    dragSessionRef.current = session;
    lastDragPositionRef.current = null;
    pendingPointerRef.current = null;
    hasDraggedRef.current = false;
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const session = dragSessionRef.current;
    if (!session) return;

    const pointer = { x: event.clientX, y: event.clientY };
    const squaredDistance =
      (pointer.x - session.startPointer.x) ** 2 +
      (pointer.y - session.startPointer.y) ** 2;

    if (!hasDraggedRef.current) {
      if (squaredDistance < DRAG_START_THRESHOLD_PX ** 2) {
        return;
      }
      hasDraggedRef.current = true;
      if (!session.hasPointerCapture) {
        event.currentTarget.setPointerCapture(session.pointerId);
        session.hasPointerCapture = true;
      }
      // Suppress the snap-to-corner transition while the user is dragging —
      // the transform must follow the pointer 1:1.
      positionerRef.current?.style.setProperty("transition", "none");
      setIsDragging(true);
    }

    event.preventDefault();
    pendingPointerRef.current = pointer;

    // Coalesce moves into a single per-frame DOM write.
    if (animationFrameIdRef.current == null) {
      animationFrameIdRef.current = window.requestAnimationFrame(
        flushPendingDragPosition
      );
    }
  };

  const finishDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    finishDragSessionRef.current({
      activateOnClick: event.type === "pointerup",
      point: { x: event.clientX, y: event.clientY },
      releaseTarget: event.currentTarget,
    });
  };

  const handleLostPointerCapture = (
    event: ReactPointerEvent<HTMLDivElement>
  ) => {
    finishDragSessionRef.current({
      activateOnClick: false,
      point: { x: event.clientX, y: event.clientY },
      releaseTarget: event.currentTarget,
    });
  };

  const handleClickCapture = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (suppressActivationRef.current) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    if (!suppressNextClickRef.current) return;
    suppressNextClickRef.current = false;
    if (suppressClickResetTimeoutIdRef.current != null) {
      window.clearTimeout(suppressClickResetTimeoutIdRef.current);
      suppressClickResetTimeoutIdRef.current = null;
    }
    event.preventDefault();
    event.stopPropagation();
  };

  const stopModalLayerPropagation = (
    event: ReactSyntheticEvent<HTMLDivElement>
  ) => {
    if (layer === "modal") {
      event.stopPropagation();
    }
  };

  const handleTransitionEnd = (event: ReactTransitionEvent<HTMLDivElement>) => {
    // Once the snap-to-corner animation finishes, clear the inline transition
    // so the next drag starts without an animated transform.
    if (event.propertyName === "transform" && !dragSessionRef.current) {
      event.currentTarget.style.removeProperty("transition");
    }
  };

  useLayoutEffect(() => {
    const previousLayer = previousLayerRef.current;
    previousLayerRef.current = layer;
    if (previousLayer !== "modal" || layer !== "content") {
      return;
    }

    finishDragSessionRef.current({
      activateOnClick: false,
      releaseTarget: positionerRef.current,
    });
    const positioner = positionerRef.current;
    suppressActivationRef.current = true;
    positioner?.setAttribute("data-activation-suppressed", "true");
    suppressActivationTimeoutIdRef.current = window.setTimeout(() => {
      suppressActivationRef.current = false;
      positioner?.removeAttribute("data-activation-suppressed");
      suppressActivationTimeoutIdRef.current = null;
    }, 0);

    return () => {
      if (suppressActivationTimeoutIdRef.current != null) {
        window.clearTimeout(suppressActivationTimeoutIdRef.current);
        suppressActivationTimeoutIdRef.current = null;
      }
      suppressActivationRef.current = false;
      positioner?.removeAttribute("data-activation-suppressed");
    };
  }, [layer]);

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

  useLayoutEffect(() => {
    const syncPinnedPosition = () => {
      if (!dragSessionRef.current) {
        applyElementPinnedPosition({
          boundary: resolvedBoundary,
          element: positionerRef.current,
          placement,
          requiresBoundary,
          size,
        });
      }
    };

    syncPinnedPosition();

    // ResizeObserver covers boundary-driven changes (panel resize, sidebar
    // toggle). visualViewport.resize covers viewport-level changes that don't
    // resize the boundary (mobile URL bar collapse, virtual keyboard).
    // visualViewport.scroll covers pinch-zoom scrolling on mobile, which
    // shifts where the boundary appears on screen.
    const observer =
      resolvedBoundary && typeof ResizeObserver === "function"
        ? new ResizeObserver(syncPinnedPosition)
        : null;
    if (resolvedBoundary && observer) {
      observer.observe(resolvedBoundary);
    }
    const handleWindowBlur = () => {
      finishDragSessionRef.current({
        activateOnClick: false,
        releaseTarget: positionerRef.current,
      });
    };
    window.visualViewport?.addEventListener("resize", syncPinnedPosition);
    window.visualViewport?.addEventListener("scroll", syncPinnedPosition);
    window.addEventListener("blur", handleWindowBlur);

    return () => {
      observer?.disconnect();
      window.visualViewport?.removeEventListener("resize", syncPinnedPosition);
      window.visualViewport?.removeEventListener("scroll", syncPinnedPosition);
      window.removeEventListener("blur", handleWindowBlur);

      if (animationFrameIdRef.current != null) {
        window.cancelAnimationFrame(animationFrameIdRef.current);
        animationFrameIdRef.current = null;
      }
      if (suppressClickResetTimeoutIdRef.current != null) {
        window.clearTimeout(suppressClickResetTimeoutIdRef.current);
        suppressClickResetTimeoutIdRef.current = null;
      }
    };
  }, [placement, requiresBoundary, resolvedBoundary, size]);

  return (
    <div
      className="agent-chat-widget-positioner"
      css={positionerCSS}
      aria-hidden={isHidden ? true : undefined}
      data-dragging={isDragging ? "true" : undefined}
      data-hidden={isHidden ? "true" : undefined}
      data-layer={layer}
      data-placement={placement}
      ref={positionerRef}
      onClick={stopModalLayerPropagation}
      onClickCapture={handleClickCapture}
      onLostPointerCaptureCapture={handleLostPointerCapture}
      onPointerCancel={stopModalLayerPropagation}
      onPointerCancelCapture={finishDrag}
      onPointerDown={stopModalLayerPropagation}
      onPointerDownCapture={handlePointerDown}
      onPointerMove={stopModalLayerPropagation}
      onPointerMoveCapture={handlePointerMove}
      onPointerUp={stopModalLayerPropagation}
      onPointerUpCapture={finishDrag}
      onTransitionEnd={handleTransitionEnd}
    >
      {children}
    </div>
  );
}
