import { css } from "@emotion/react";
import type {
  CSSProperties,
  KeyboardEvent,
  PointerEvent,
  ReactNode,
  Ref,
} from "react";
import { useId, useRef, useState } from "react";
import { OverlayTriggerStateContext } from "react-aria-components";
import { useHotkeys } from "react-hotkeys-hook";

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
} from "./constants";

/**
 * Resolve a {@link SizeValue} to pixels using the current viewport width.
 */
function resolveToPixels(value: SizeValue): number {
  if (typeof value === "number") return value;
  return (parseFloat(value) / 100) * window.innerWidth;
}

const KEYBOARD_RESIZE_STEP_PERCENT = 5;
const normalizeSize = (value: number) => Number(value.toFixed(3));

const drawerCSS = css`
  --visual-viewport-height: 100vh;
  height: var(--visual-viewport-height);
  position: fixed;
  display: flex;
  align-items: flex-start;
  justify-content: flex-end;
  z-index: var(--global-z-index-app-drawer);
  top: 0;
  right: 0;
  left: auto;
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
  /** Initial size. Pixels (number) or percentage of viewport (e.g. "35%"). */
  defaultSize?: SizeValue;
  /** Minimum size. Pixels (number) or percentage of viewport (e.g. "50%"). */
  minSize?: SizeValue;
  /** Maximum size. Pixels (number) or percentage of viewport (e.g. "95%"). */
  maxSize?: SizeValue;
  /**
   * Fires on every rAF-throttled drag update and on drag end with the
   * current width as a viewport percentage and in pixels. Pair with the
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
 * A resizable, non-modal side panel pinned to the right edge of the viewport.
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
  const resolvedMinSize = minSize ?? DRAWER_DEFAULT_MIN_SIZE;
  const resolvedMaxSize = maxSize ?? DRAWER_DEFAULT_MAX_SIZE;
  const initialSize = defaultSize ?? DRAWER_DEFAULT_SIZE;
  const isPixelBased = typeof initialSize === "number";

  /** Resolve min to pixels, enforcing the hard pixel floor. */
  const resolveMin = () =>
    Math.max(resolveToPixels(resolvedMinSize), DRAWER_HARD_MIN_SIZE_PX);

  /** Resolve max to pixels, capped by the viewport width so the drawer
   *  can never exceed it regardless of what `maxSize` resolves to. */
  const resolveMax = () => {
    const maxPx = Math.min(resolveToPixels(resolvedMaxSize), window.innerWidth);
    return Math.max(maxPx, resolveMin());
  };

  /** Clamp a viewport percentage between the resolved min and max bounds. */
  const clampPercent = (pct: number) => {
    const vw = window.innerWidth;
    const minPct = (resolveMin() / vw) * 100;
    const maxPct = (resolveMax() / vw) * 100;
    return normalizeSize(Math.min(Math.max(pct, minPct), maxPct));
  };

  const clampPixels = (pixels: number) =>
    normalizeSize(Math.min(Math.max(pixels, resolveMin()), resolveMax()));

  const [size, setSize] = useState<number>(() => {
    if (isPixelBased) return initialSize;
    const initialPx = resolveToPixels(initialSize);
    return clampPercent((initialPx / window.innerWidth) * 100);
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
  const startXRef = useRef(0);
  const startSizeRef = useRef(0);
  const dragSizeRef = useRef(0);
  const pendingSizeRef = useRef<number | null>(null);
  const rafIdRef = useRef<number | null>(null);
  const hasDragResizeEmittedRef = useRef(false);

  const getSizePixels = (value: number) =>
    isPixelBased
      ? clampPixels(value)
      : normalizeSize((clampPercent(value) / 100) * window.innerWidth);
  const getSizePercent = (value: number) =>
    normalizeSize((getSizePixels(value) / window.innerWidth) * 100);

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

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    startXRef.current = event.clientX;
    startSizeRef.current = isPixelBased ? getSizePixels(size) : size;
    dragSizeRef.current = startSizeRef.current;
    isDraggingRef.current = true;
    hasDragResizeEmittedRef.current = false;
    setIsDragging(true);
    event.preventDefault();
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    // Drawer is pinned to the right edge — dragging left (negative delta)
    // increases width; dragging right decreases it. Preserve the unit of the
    // initial size so factory pixel widths do not become viewport-relative.
    const deltaPixels = event.clientX - startXRef.current;
    dragSizeRef.current = isPixelBased
      ? clampPixels(startSizeRef.current - deltaPixels)
      : clampPercent(
          startSizeRef.current - (deltaPixels / window.innerWidth) * 100
        );
    if (dragSizeRef.current !== startSizeRef.current) {
      hasUserResizedSinceOpenRef.current = true;
    }
    pendingSizeRef.current = dragSizeRef.current;
    if (rafIdRef.current == null) {
      rafIdRef.current = requestAnimationFrame(flushPendingSize);
    }
  };

  const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;

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
    isDraggingRef.current = false;

    setIsDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const commitSize = (nextPixels: number) => {
    const clampedPixels = clampPixels(nextPixels);
    const nextSize = isPixelBased
      ? clampedPixels
      : normalizeSize((clampedPixels / window.innerWidth) * 100);
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
      : normalizeSize((clampedPixels / window.innerWidth) * 100);
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
            (KEYBOARD_RESIZE_STEP_PERCENT / 100) * window.innerWidth
        );
        break;
      case "ArrowRight":
        event.preventDefault();
        commitSize(
          getSizePixels(size) -
            (KEYBOARD_RESIZE_STEP_PERCENT / 100) * window.innerWidth
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
  useHotkeys("Escape", closeDrawer, { enabled: isOpen });

  if (!isOpen) return null;

  const minPx = resolveMin();
  const maxPx = resolveMax();
  const sizePercent = getSizePercent(size);
  const resizeController = {
    getSizePixels: () => getSizePixels(size),
    getMaximumSizePixels: resolveMax,
    resizeToPixels: resizeFromDescendant,
  };

  const style = {
    width: isPixelBased ? `${size}px` : `${size}vw`,
    minWidth: `${minPx}px`,
    maxWidth:
      typeof resolvedMaxSize === "number"
        ? `${resolvedMaxSize}px`
        : `${parseFloat(resolvedMaxSize)}vw`,
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

  return (
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
              aria-valuemin={Math.round((minPx / window.innerWidth) * 100)}
              aria-valuemax={Math.round((maxPx / window.innerWidth) * 100)}
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
      </DrawerResizeContext.Provider>
    </DrawerContext.Provider>
  );
}
