import { css } from "@emotion/react";
import type { CSSProperties, KeyboardEvent, ReactNode, Ref } from "react";
import {
  useEffect,
  useEffectEvent,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { OverlayTriggerStateContext } from "react-aria-components";
import { createPortal } from "react-dom";
import { useHotkeys } from "react-hotkeys-hook";

import { useAppFrameOverlay } from "@phoenix/components/core/overlay/AppFrameOverlayContext";
import {
  DrawerContext,
  DrawerResizeContext,
} from "@phoenix/components/core/overlay/DrawerContext";
import { diagnosticResizeHandleCSS } from "@phoenix/components/resize";
import type { SizeValue } from "@phoenix/types/sizing";

import {
  DRAWER_CLASS_NAME,
  DRAWER_DEFAULT_MAX_SIZE,
  DRAWER_DEFAULT_MIN_SIZE,
  DRAWER_DEFAULT_SIZE,
  DRAWER_HARD_MIN_SIZE_PX,
  DRAWER_VISIBLE_GUTTER_PX,
} from "./constants";

/**
 * Resolve a {@link SizeValue} to pixels using the application viewport width.
 */
function resolveToPixels(value: SizeValue, containerWidth: number): number {
  if (typeof value === "number") return value;
  return (parseFloat(value) / 100) * containerWidth;
}

const KEYBOARD_RESIZE_STEP_PERCENT = 5;
const normalizeSize = (value: number) => Number(value.toFixed(3));

const drawerCSS = css`
  height: 100%;
  position: absolute;
  display: flex;
  align-items: flex-start;
  justify-content: flex-end;
  z-index: var(--global-z-index-app-drawer);
  top: 0;
  right: 0;
  left: auto;
  pointer-events: auto;

  &[data-frame-hosted="false"] {
    position: fixed;
    height: 100vh;
  }

  .drawer__resize-handle {
    ${diagnosticResizeHandleCSS};
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: var(--global-border-size-thin);
    cursor: ew-resize;
    /* Keep the drawer edge above descendant overlays that create a higher
       local stacking context, such as the collapsed trace-tree preview. */
    z-index: calc(var(--global-z-index-local-control) + 2);
    touch-action: none;
  }

  .drawer__resize-handle:focus-visible {
    outline: var(--focus-ring-thickness) solid var(--focus-ring-color);
    outline-offset: var(--focus-ring-offset);
  }

  &[data-dragging="true"] {
    user-select: none;
  }

  .react-aria-Dialog {
    box-shadow:
      inset 1px 0 0 var(--global-border-color-default),
      0 8px 20px rgba(0 0 0 / 0.1);
    width: 100%;
    height: 100%;
    border-radius: 0;
    background: var(--global-background-color-default);
    color: var(--global-text-color-900);
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
   * current width as an application-viewport percentage and in pixels. Pair with the
   * `useDefaultDrawerSize` hook to persist size between visits.
   */
  onResize?: (sizePercent: number, sizePixels: number) => void;
  /**
   * Fires after a keyboard resize or a pointer gesture that emitted at least
   * one width change. A pointer gesture that returns to its starting width
   * still emits this matching end event. Use this instead of `onResize` when
   * transient drag widths must not be persisted as user preferences.
   */
  onResizeEnd?: (sizePercent: number, sizePixels: number) => void;
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
 * const { defaultSize, onSizeChange, onSizeChangeEnd } =
 *   useDefaultDrawerSize({
 *   id: "trace-details",
 * });
 *
 * <Drawer
 *   isOpen={selectedId != null}
 *   onClose={() => setSelectedId(null)}
 *   defaultSize={defaultSize}
 *   minSize={DRAWER_DEFAULT_MIN_SIZE}
 *   onResize={onSizeChange}
 *   onResizeEnd={onSizeChangeEnd}
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
  onResizeEnd,
  children,
}: DrawerProps) {
  const drawerId = useId();
  const appFrameOverlay = useAppFrameOverlay();
  const drawerHostElement = appFrameOverlay?.drawerHostElement ?? null;
  const getContainerWidth = () =>
    drawerHostElement?.getBoundingClientRect().width || window.innerWidth;
  const [containerWidth, setContainerWidth] = useState(getContainerWidth);
  const resolvedMinSize = minSize ?? DRAWER_DEFAULT_MIN_SIZE;
  const resolvedMaxSize = maxSize ?? DRAWER_DEFAULT_MAX_SIZE;
  const initialSize = defaultSize ?? DRAWER_DEFAULT_SIZE;
  const isPixelBased = typeof initialSize === "number";

  /** Resolve min to pixels, enforcing the hard pixel floor. */
  const resolveMin = () =>
    Math.min(
      containerWidth,
      Math.max(
        resolveToPixels(resolvedMinSize, containerWidth),
        DRAWER_HARD_MIN_SIZE_PX
      )
    );

  /** Resolve max while preserving a visible application-viewport gutter. */
  const resolveMax = () => {
    const availableWidth = Math.max(
      containerWidth - DRAWER_VISIBLE_GUTTER_PX,
      0
    );
    const maxPx = Math.min(
      resolveToPixels(resolvedMaxSize, containerWidth),
      availableWidth
    );
    return Math.max(maxPx, resolveMin());
  };

  /** Clamp a container percentage between the resolved min and max bounds. */
  const clampPercent = (pct: number) => {
    const minPct = (resolveMin() / containerWidth) * 100;
    const maxPct = (resolveMax() / containerWidth) * 100;
    return normalizeSize(Math.min(Math.max(pct, minPct), maxPct));
  };

  const clampPixels = (pixels: number) =>
    normalizeSize(Math.min(Math.max(pixels, resolveMin()), resolveMax()));

  const [size, setSize] = useState<number>(() => {
    if (isPixelBased) return initialSize;
    const initialPx = resolveToPixels(initialSize, getContainerWidth());
    return clampPercent((initialPx / getContainerWidth()) * 100);
  });
  const [isDragging, setIsDragging] = useState(false);
  const currentSizeRef = useRef(size);
  const hasUserResizedSinceOpenRef = useRef(false);

  // Drag-session refs are the source of truth during a drag. Using refs
  // instead of state bypasses React batching (so pointermove handlers never
  // read a stale `isDragging`) and lets us coalesce pointer-rate updates
  // into a single rAF per frame — matches how react-resizable-panels keeps
  // its drag path off the render loop.
  const isDraggingRef = useRef(false);
  const activePointerIdRef = useRef<number | null>(null);
  const startXRef = useRef(0);
  const startSizeRef = useRef(0);
  const dragSizeRef = useRef(0);
  const pendingSizeRef = useRef<number | null>(null);
  const rafIdRef = useRef<number | null>(null);
  const hasDragResizeEmittedRef = useRef(false);

  const getSizePixels = (value: number) =>
    isPixelBased
      ? clampPixels(value)
      : normalizeSize((clampPercent(value) / 100) * containerWidth);
  const getSizePercent = (value: number) =>
    normalizeSize((getSizePixels(value) / containerWidth) * 100);

  useLayoutEffect(() => {
    const updateContainerWidth = () => setContainerWidth(getContainerWidth());
    updateContainerWidth();

    const resizeObserver = drawerHostElement
      ? new ResizeObserver(updateContainerWidth)
      : null;
    if (drawerHostElement && resizeObserver) {
      resizeObserver.observe(drawerHostElement);
    } else {
      window.addEventListener("resize", updateContainerWidth);
    }

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener("resize", updateContainerWidth);
    };
  }, [drawerHostElement]);

  const commitResize = (nextSize: number) => {
    if (nextSize === currentSizeRef.current) return;
    currentSizeRef.current = nextSize;
    setSize(nextSize);
    onResize?.(getSizePercent(nextSize), getSizePixels(nextSize));
    if (isDraggingRef.current) {
      hasDragResizeEmittedRef.current = true;
    }
  };

  const notifyResizeEnd = (nextSize: number) => {
    onResizeEnd?.(getSizePercent(nextSize), getSizePixels(nextSize));
  };

  const flushPendingSize = () => {
    rafIdRef.current = null;
    if (pendingSizeRef.current == null) return;
    const nextSize = pendingSizeRef.current;
    pendingSizeRef.current = null;
    commitResize(nextSize);
  };

  const resizeHandleRef = useRef<HTMLDivElement>(null);

  const handleWindowPointerDown = useEffectEvent((event: PointerEvent) => {
    const resizeHandle = resizeHandleRef.current;
    const eventTarget = event.target;
    if (
      !isOpen ||
      !event.isPrimary ||
      (event.pointerType === "mouse" && event.button !== 0) ||
      !(eventTarget instanceof Node) ||
      !resizeHandle?.contains(eventTarget)
    ) {
      return;
    }

    // react-resizable-panels owns descendant separators from a document
    // capture listener. Reserve the outer-edge gesture at window capture so
    // crossing a descendant separator cannot activate a second resize owner.
    event.preventDefault();
    event.stopPropagation();
    resizeHandle.focus({ preventScroll: true });
    resizeHandle.setPointerCapture(event.pointerId);
    activePointerIdRef.current = event.pointerId;
    startXRef.current = event.clientX;
    startSizeRef.current = isPixelBased
      ? getSizePixels(currentSizeRef.current)
      : currentSizeRef.current;
    dragSizeRef.current = startSizeRef.current;
    isDraggingRef.current = true;
    hasDragResizeEmittedRef.current = false;
    setIsDragging(true);
  });

  const handleWindowPointerMove = useEffectEvent((event: PointerEvent) => {
    if (activePointerIdRef.current !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    // Drawer is pinned to the right edge — dragging left (negative delta)
    // increases width; dragging right decreases it. Preserve the unit of the
    // initial size so factory pixel widths do not become viewport-relative.
    const deltaPixels = event.clientX - startXRef.current;
    dragSizeRef.current = isPixelBased
      ? clampPixels(startSizeRef.current - deltaPixels)
      : clampPercent(
          startSizeRef.current - (deltaPixels / containerWidth) * 100
        );
    if (dragSizeRef.current !== startSizeRef.current) {
      hasUserResizedSinceOpenRef.current = true;
    }
    pendingSizeRef.current = dragSizeRef.current;
    if (rafIdRef.current == null) {
      rafIdRef.current = requestAnimationFrame(flushPendingSize);
    }
  });

  const finishWindowPointerResize = useEffectEvent((event: PointerEvent) => {
    if (activePointerIdRef.current !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();

    // Cancel any pending frame and commit the latest pointer position
    // synchronously so the released width matches where the cursor actually
    // ended (no lingering 16ms drift).
    if (rafIdRef.current != null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    if (pendingSizeRef.current != null) {
      const finalSize = pendingSizeRef.current;
      pendingSizeRef.current = null;
      commitResize(finalSize);
    }
    if (hasDragResizeEmittedRef.current) {
      notifyResizeEnd(dragSizeRef.current);
    }
    hasDragResizeEmittedRef.current = false;
    activePointerIdRef.current = null;
    isDraggingRef.current = false;

    setIsDragging(false);
    const resizeHandle = resizeHandleRef.current;
    if (resizeHandle?.hasPointerCapture(event.pointerId)) {
      resizeHandle.releasePointerCapture(event.pointerId);
    }
  });

  useEffect(() => {
    window.addEventListener("pointerdown", handleWindowPointerDown, true);
    window.addEventListener("pointermove", handleWindowPointerMove, true);
    window.addEventListener("pointerup", finishWindowPointerResize, true);
    window.addEventListener("pointercancel", finishWindowPointerResize, true);
    return () => {
      window.removeEventListener("pointerdown", handleWindowPointerDown, true);
      window.removeEventListener("pointermove", handleWindowPointerMove, true);
      window.removeEventListener("pointerup", finishWindowPointerResize, true);
      window.removeEventListener(
        "pointercancel",
        finishWindowPointerResize,
        true
      );
    };
  }, []);

  const commitSize = (nextPixels: number) => {
    const clampedPixels = clampPixels(nextPixels);
    const nextSize = isPixelBased
      ? clampedPixels
      : normalizeSize((clampedPixels / containerWidth) * 100);
    const currentSize = isPixelBased ? getSizePixels(size) : clampPercent(size);
    if (nextSize !== currentSize) {
      hasUserResizedSinceOpenRef.current = true;
      commitResize(nextSize);
      notifyResizeEnd(nextSize);
    }
  };

  const resizeFromDescendant = (nextPixels: number) => {
    const clampedPixels = clampPixels(nextPixels);
    const nextSize = isPixelBased
      ? clampedPixels
      : normalizeSize((clampedPixels / containerWidth) * 100);
    currentSizeRef.current = nextSize;
    setSize(nextSize);
    return clampedPixels;
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    switch (event.key) {
      case "ArrowLeft":
        event.preventDefault();
        commitSize(
          getSizePixels(size) +
            (KEYBOARD_RESIZE_STEP_PERCENT / 100) * containerWidth
        );
        break;
      case "ArrowRight":
        event.preventDefault();
        commitSize(
          getSizePixels(size) -
            (KEYBOARD_RESIZE_STEP_PERCENT / 100) * containerWidth
        );
        break;
      case "Home":
        event.preventDefault();
        commitSize(resolveMin());
        break;
      case "End":
        event.preventDefault();
        commitSize(resolveMax());
        break;
    }
  };

  const closeDrawer = () => {
    // Close is the persistence barrier. A completed pointer release already
    // commits through onResizeEnd, but closing repeats that commit from the
    // Drawer's own synchronous size ref. This makes close/reopen independent
    // of pointer-delivery, React scheduling, and debounce ordering.
    if (rafIdRef.current != null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    if (pendingSizeRef.current != null) {
      const finalSize = pendingSizeRef.current;
      pendingSizeRef.current = null;
      commitResize(finalSize);
    }
    if (hasUserResizedSinceOpenRef.current) {
      notifyResizeEnd(currentSizeRef.current);
      hasUserResizedSinceOpenRef.current = false;
    }
    onClose?.();
  };

  // Global Escape listener — works regardless of where focus is so the
  // drawer can be dismissed while interacting with the content behind it.
  // A transient child experience can consume Escape first by preventing the
  // event, leaving a later Escape to close the drawer itself.
  useHotkeys(
    "Escape",
    (event) => {
      if (!event.defaultPrevented) {
        closeDrawer();
      }
    },
    { enabled: isOpen }
  );

  if (!isOpen || (appFrameOverlay && !drawerHostElement)) return null;

  const minPx = resolveMin();
  const maxPx = resolveMax();
  const sizePercent = getSizePercent(size);
  const resizeController = {
    getSizePixels: () => getSizePixels(size),
    getMaximumSizePixels: resolveMax,
    resizeToPixels: resizeFromDescendant,
  };

  const style = {
    width: isPixelBased
      ? `${getSizePixels(size)}px`
      : drawerHostElement
        ? `${clampPercent(size)}%`
        : `${clampPercent(size)}vw`,
    minWidth: `${minPx}px`,
    maxWidth: `${maxPx}px`,
  } as CSSProperties;

  // Provide OverlayTriggerStateContext so react-aria's Dialog render prop
  // surfaces a working `close` function and `slot="close"` auto-wires.
  const overlayState = {
    isOpen: true as const,
    open: () => {},
    close: closeDrawer,
    toggle: closeDrawer,
    setOpen: (open: boolean) => {
      if (!open) closeDrawer();
    },
  };

  const drawer = (
    <DrawerContext.Provider value={true}>
      <DrawerResizeContext.Provider value={resizeController}>
        <OverlayTriggerStateContext.Provider value={overlayState}>
          <div
            role="complementary"
            id={drawerId}
            className={DRAWER_CLASS_NAME}
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
              onKeyDown={handleKeyDown}
              ref={resizeHandleRef}
            />
            {children}
          </div>
        </OverlayTriggerStateContext.Provider>
      </DrawerResizeContext.Provider>
    </DrawerContext.Provider>
  );

  return drawerHostElement ? createPortal(drawer, drawerHostElement) : drawer;
}
