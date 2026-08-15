import { css, keyframes } from "@emotion/react";
import type {
  CSSProperties,
  KeyboardEvent,
  PointerEvent,
  ReactNode,
  Ref,
} from "react";
import { useId, useLayoutEffect, useRef, useState } from "react";
import { OverlayTriggerStateContext } from "react-aria-components";
import { createPortal } from "react-dom";
import { useHotkeys } from "react-hotkeys-hook";

import {
  DRAWER_DEFAULT_MAX_SIZE,
  DRAWER_DEFAULT_MIN_SIZE,
  DRAWER_DEFAULT_SIZE,
  DRAWER_HARD_MIN_SIZE_PX,
  DRAWER_SIDE_NAV_GAP_PX,
  DRAWER_VISIBLE_GUTTER_PX,
} from "./constants";
import { DrawerContext } from "./DrawerContext";
import { useOverlayFrame } from "./frame";
import type { SizeValue } from "./sizing";
import { LOCAL_RAISED_Z_INDEX } from "./stacking";
import { createDismissTriggerState } from "./triggerState";

/**
 * Resolve a {@link SizeValue} to pixels using the containing viewport width.
 */
function resolveToPixels({
  containerWidth,
  value,
}: {
  containerWidth: number;
  value: SizeValue;
}): number {
  if (typeof value === "number") return value;
  return (parseFloat(value) / 100) * containerWidth;
}

const RESIZE_HANDLE_WIDTH_PX = 4;
const KEYBOARD_RESIZE_STEP_PERCENT = 5;

const drawerSlideIn = keyframes`
  from {
    transform: translateX(100%);
  }
  to {
    transform: translateX(0);
  }
`;

const drawerCSS = css`
  height: 100%;
  position: absolute;
  display: flex;
  align-items: flex-start;
  justify-content: flex-end;
  z-index: ${LOCAL_RAISED_Z_INDEX};
  top: 0;
  right: 0;
  left: auto;
  animation: ${drawerSlideIn} 300ms;
  pointer-events: auto;

  &[data-frame-hosted="false"] {
    position: fixed;
    height: 100vh;
  }

  .drawer__resize-handle {
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: ${RESIZE_HANDLE_WIDTH_PX}px;
    cursor: ew-resize;
    z-index: 2;
    touch-action: none;
    background-color: transparent;
    transition: background-color 150ms ease-out;
  }

  .drawer__resize-handle:hover,
  .drawer__resize-handle[data-dragging="true"],
  .drawer__resize-handle:focus-visible {
    background-color: var(--global-border-color-default);
  }

  .drawer__resize-handle:focus-visible {
    outline: var(--focus-ring-thickness) solid var(--focus-ring-color);
    outline-offset: var(--focus-ring-offset);
  }

  &[data-dragging="true"] {
    user-select: none;
  }

  .react-aria-Dialog {
    box-shadow: 0 8px 20px rgba(0 0 0 / 0.1);
    width: 100%;
    height: 100%;
    border-radius: 0;
    background: var(--global-background-color-default);
    color: var(--global-text-color-900);
    border-left: 1px solid var(--global-border-color-default);
    outline: none;
  }
`;

export type DrawerProps = {
  /** Whether the drawer is open. */
  isOpen?: boolean;
  /** Called when the drawer should close (Escape key, close button, etc.). */
  onClose?: () => void;
  /** Initial size. Pixels or percentage of the application viewport. */
  defaultSize?: SizeValue;
  /** Minimum size. Pixels or percentage of the application viewport. */
  minSize?: SizeValue;
  /** Maximum size. Pixels or percentage of the application viewport. */
  maxSize?: SizeValue;
  /**
   * Fires on every rAF-throttled drag update and on drag end with the
   * current width as an application-viewport percentage. Pair with
   * the `useDefaultDrawerSize` hook to persist size between visits.
   */
  onResize?: (sizePercent: number) => void;
  children?: ReactNode;
  ref?: Ref<HTMLDivElement>;
};

/**
 * A resizable, non-modal side panel pinned to the application viewport.
 *
 * Unlike a `<Modal>`, the Drawer does **not** block interaction with the
 * content behind it — users can click, scroll, and navigate the underlying
 * page while the drawer is open.
 *
 * ```tsx
 * const { defaultSize, onSizeChange } = useDefaultDrawerSize({
 *   id: "trace-details",
 * });
 *
 * <Drawer
 *   isOpen={selectedId != null}
 *   onClose={() => setSelectedId(null)}
 *   defaultSize={defaultSize}
 *   minSize={DRAWER_DEFAULT_MIN_SIZE}
 *   onResize={onSizeChange}
 * >
 *   <Dialog>
 *     {({ close }) => ( ... )}
 *   </Dialog>
 * </Drawer>
 * ```
 */
export function Drawer({
  ref,
  isOpen,
  onClose,
  defaultSize,
  minSize,
  maxSize,
  onResize,
  children,
}: DrawerProps) {
  const drawerId = useId();
  const frame = useOverlayFrame();
  const drawerHostElement = frame?.drawerHostElement ?? null;
  const sideNavigationElement = frame?.sideNavigationElement ?? null;
  const getContainerWidth = () =>
    drawerHostElement?.getBoundingClientRect().width || window.innerWidth;
  const getVisibleGutterWidth = () =>
    Math.max(
      DRAWER_VISIBLE_GUTTER_PX,
      (sideNavigationElement?.getBoundingClientRect().width ?? 0) +
        DRAWER_SIDE_NAV_GAP_PX
    );
  const [containerWidth, setContainerWidth] = useState(getContainerWidth);
  const [visibleGutterWidth, setVisibleGutterWidth] = useState(
    getVisibleGutterWidth
  );
  const resolvedMinSize = minSize ?? DRAWER_DEFAULT_MIN_SIZE;
  const resolvedMaxSize = maxSize ?? DRAWER_DEFAULT_MAX_SIZE;

  /** Resolve min to pixels, enforcing the hard floor when it fits. */
  const resolveMin = (width = containerWidth) =>
    Math.min(
      width,
      Math.max(
        resolveToPixels({ containerWidth: width, value: resolvedMinSize }),
        DRAWER_HARD_MIN_SIZE_PX
      )
    );

  /** Resolve max while preserving the side navigation or minimum gutter. */
  const resolveMax = (
    width = containerWidth,
    gutterWidth = visibleGutterWidth
  ) => {
    const requestedMax = resolveToPixels({
      containerWidth: width,
      value: resolvedMaxSize,
    });
    const availableMax = Math.max(width - gutterWidth, 0);
    return Math.max(Math.min(requestedMax, availableMax), resolveMin(width));
  };

  /** Clamp a percentage between the resolved container-relative bounds. */
  const clampPercent = (
    percent: number,
    width = containerWidth,
    gutterWidth = visibleGutterWidth
  ) => {
    if (width <= 0) return 0;
    const minPercent = (resolveMin(width) / width) * 100;
    const maxPercent = (resolveMax(width, gutterWidth) / width) * 100;
    return Math.min(Math.max(percent, minPercent), maxPercent);
  };

  const [sizePercent, setSizePercent] = useState<number>(() => {
    const width = getContainerWidth();
    const gutterWidth = getVisibleGutterWidth();
    const initialPx = resolveToPixels({
      containerWidth: width,
      value: defaultSize ?? DRAWER_DEFAULT_SIZE,
    });
    return clampPercent((initialPx / width) * 100, width, gutterWidth);
  });
  const [isDragging, setIsDragging] = useState(false);

  // Drag-session refs are the source of truth during a drag. Using refs
  // instead of state bypasses React batching (so pointermove handlers never
  // read a stale `isDragging`) and lets us coalesce pointer-rate updates
  // into a single rAF per frame — matches how react-resizable-panels keeps
  // its drag path off the render loop.
  const isDraggingRef = useRef(false);
  const startXRef = useRef(0);
  const startPercentRef = useRef(0);
  const pendingPercentRef = useRef<number | null>(null);
  const rafIdRef = useRef<number | null>(null);

  const hasInitializedContainerSizeRef = useRef(frame == null);

  useLayoutEffect(() => {
    const container = drawerHostElement;
    const sideNavigation = sideNavigationElement;
    const updateFrameMeasurements = () => {
      const nextWidth =
        container?.getBoundingClientRect().width || window.innerWidth;
      const nextGutterWidth = Math.max(
        DRAWER_VISIBLE_GUTTER_PX,
        (sideNavigation?.getBoundingClientRect().width ?? 0) +
          DRAWER_SIDE_NAV_GAP_PX
      );
      setContainerWidth(nextWidth);
      setVisibleGutterWidth(nextGutterWidth);
      setSizePercent((currentPercent) => {
        if (!hasInitializedContainerSizeRef.current && container) {
          hasInitializedContainerSizeRef.current = true;
          const initialPx = resolveToPixels({
            containerWidth: nextWidth,
            value: defaultSize ?? DRAWER_DEFAULT_SIZE,
          });
          return clampPercent(
            (initialPx / nextWidth) * 100,
            nextWidth,
            nextGutterWidth
          );
        }
        return clampPercent(currentPercent, nextWidth, nextGutterWidth);
      });
    };

    updateFrameMeasurements();
    const resizeObserver =
      container || sideNavigation
        ? new ResizeObserver(updateFrameMeasurements)
        : null;
    if (container && resizeObserver) resizeObserver.observe(container);
    if (sideNavigation && resizeObserver) {
      resizeObserver.observe(sideNavigation);
    }
    if (!container) {
      window.addEventListener("resize", updateFrameMeasurements);
    }

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener("resize", updateFrameMeasurements);
    };
  }, [
    defaultSize,
    drawerHostElement,
    resolvedMaxSize,
    resolvedMinSize,
    sideNavigationElement,
  ]);

  const flushPendingSize = () => {
    rafIdRef.current = null;
    if (pendingPercentRef.current == null) return;
    const next = pendingPercentRef.current;
    pendingPercentRef.current = null;
    setSizePercent(next);
    onResize?.(next);
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    startXRef.current = event.clientX;
    startPercentRef.current = sizePercent;
    isDraggingRef.current = true;
    setIsDragging(true);
    event.preventDefault();
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    // Drawer is pinned to the right edge — dragging left (negative delta)
    // increases width; dragging right decreases it. Work entirely in
    // container percentages to avoid unnecessary pixel round-tripping.
    const deltaPct =
      ((event.clientX - startXRef.current) / containerWidth) * 100;
    pendingPercentRef.current = clampPercent(
      startPercentRef.current - deltaPct
    );
    if (rafIdRef.current == null) {
      rafIdRef.current = requestAnimationFrame(flushPendingSize);
    }
  };

  const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;

    // Cancel any pending frame and commit the latest pointer position
    // synchronously so the released width matches where the cursor actually
    // ended (no lingering 16ms drift).
    if (rafIdRef.current != null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    let finalPercent = sizePercent;
    if (pendingPercentRef.current != null) {
      finalPercent = pendingPercentRef.current;
      pendingPercentRef.current = null;
      setSizePercent(finalPercent);
      onResize?.(finalPercent);
    }

    setIsDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const commitSize = (nextPercent: number) => {
    const next = clampPercent(nextPercent);
    setSizePercent(next);
    onResize?.(next);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    switch (event.key) {
      case "ArrowLeft":
        event.preventDefault();
        commitSize(sizePercent + KEYBOARD_RESIZE_STEP_PERCENT);
        break;
      case "ArrowRight":
        event.preventDefault();
        commitSize(sizePercent - KEYBOARD_RESIZE_STEP_PERCENT);
        break;
      case "Home":
        event.preventDefault();
        commitSize((resolveMin() / containerWidth) * 100);
        break;
      case "End":
        event.preventDefault();
        commitSize((resolveMax() / containerWidth) * 100);
        break;
    }
  };

  // Global Escape listener — works regardless of where focus is so the
  // drawer can be dismissed while interacting with the content behind it.
  // Guarded on the frame's blocked state because this listener sits outside
  // React Aria's overlay stack: an open viewport modal owns Escape.
  useHotkeys("Escape", () => onClose?.(), {
    enabled: isOpen && !(frame?.isViewportBlocked ?? false),
  });

  if (!isOpen || (frame && !drawerHostElement)) return null;

  const minPx = resolveMin();
  const maxPx = resolveMax();

  const style = {
    width: drawerHostElement ? `${sizePercent}%` : `${sizePercent}vw`,
    minWidth: `${minPx}px`,
    maxWidth: `${maxPx}px`,
  } as CSSProperties;

  // Provide OverlayTriggerStateContext so react-aria's Dialog render prop
  // surfaces a working `close` function and `slot="close"` auto-wires.
  const overlayState = createDismissTriggerState(() => onClose?.());

  const drawer = (
    <DrawerContext.Provider value={true}>
      <OverlayTriggerStateContext.Provider value={overlayState}>
        <div
          role="complementary"
          id={drawerId}
          className="drawer"
          aria-label="Detail drawer"
          css={drawerCSS}
          data-dragging={isDragging ? "true" : undefined}
          data-frame-hosted={drawerHostElement ? "true" : "false"}
          style={style}
          ref={ref}
        >
          <div
            role="separator"
            tabIndex={0}
            aria-controls={drawerId}
            aria-orientation="vertical"
            aria-label="Resize drawer"
            aria-valuenow={Math.round(sizePercent)}
            aria-valuemin={Math.round((minPx / containerWidth) * 100)}
            aria-valuemax={Math.round((maxPx / containerWidth) * 100)}
            className="drawer__resize-handle"
            data-dragging={isDragging ? "true" : undefined}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onKeyDown={handleKeyDown}
          />
          {children}
        </div>
      </OverlayTriggerStateContext.Provider>
    </DrawerContext.Provider>
  );

  return drawerHostElement ? createPortal(drawer, drawerHostElement) : drawer;
}
