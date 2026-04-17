import { css, keyframes } from "@emotion/react";
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

import { DrawerContext } from "@phoenix/components/core/overlay/DrawerContext";
import type { SizeValue } from "@phoenix/types/sizing";

import {
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
  --visual-viewport-height: 100vh;
  height: var(--visual-viewport-height);
  position: fixed;
  display: flex;
  align-items: flex-start;
  justify-content: flex-end;
  z-index: 100;
  top: 0;
  right: 0;
  left: auto;
  animation: ${drawerSlideIn} 300ms;

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
    outline: 2px solid var(--global-color-primary);
    outline-offset: 2px;
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

    & .dialog__header {
      position: sticky;
      top: 0;
      z-index: 1;
    }
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
   * current width as a viewport percentage (e.g. 50 for 50%). Pair with
   * the `useDefaultDrawerSize` hook to persist size between visits.
   */
  onResize?: (sizePercent: number) => void;
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
  const resolvedMinSize = minSize ?? DRAWER_DEFAULT_MIN_SIZE;
  const resolvedMaxSize = maxSize ?? DRAWER_DEFAULT_MAX_SIZE;

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
    return Math.min(Math.max(pct, minPct), maxPct);
  };

  const [sizePercent, setSizePercent] = useState<number>(() => {
    const initialPx = resolveToPixels(defaultSize ?? DRAWER_DEFAULT_SIZE);
    return clampPercent((initialPx / window.innerWidth) * 100);
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
    // viewport percentages to avoid unnecessary pixel round-tripping.
    const deltaPct =
      ((event.clientX - startXRef.current) / window.innerWidth) * 100;
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
        commitSize((resolveMin() / window.innerWidth) * 100);
        break;
      case "End":
        event.preventDefault();
        commitSize((resolveMax() / window.innerWidth) * 100);
        break;
    }
  };

  // Global Escape listener — works regardless of where focus is so the
  // drawer can be dismissed while interacting with the content behind it.
  useHotkeys("Escape", () => onClose?.(), { enabled: isOpen });

  if (!isOpen) return null;

  const minPx = resolveMin();
  const maxPx = resolveMax();

  const style = {
    width: `${sizePercent}vw`,
    minWidth: `${minPx}px`,
  } as CSSProperties;

  // Provide OverlayTriggerStateContext so react-aria's Dialog render prop
  // surfaces a working `close` function and `slot="close"` auto-wires.
  const overlayState = {
    isOpen: true as const,
    open: () => {},
    close: () => onClose?.(),
    toggle: () => onClose?.(),
    setOpen: (open: boolean) => {
      if (!open) onClose?.();
    },
  };

  return (
    <DrawerContext.Provider value={true}>
      <OverlayTriggerStateContext.Provider value={overlayState}>
        <div
          role="complementary"
          id={drawerId}
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
    </DrawerContext.Provider>
  );
}
