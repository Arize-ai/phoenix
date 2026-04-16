import { css, keyframes } from "@emotion/react";
import type { CSSProperties, PointerEvent, Ref } from "react";
import { useRef, useState } from "react";
import type { ModalOverlayProps as AriaModalOverlayProps } from "react-aria-components";
import {
  Modal as AriaModal,
  ModalOverlay as AriaModalOverlay,
} from "react-aria-components";

import {
  ModalContext,
  RESIZABLE_MODAL_CONTEXT,
} from "@phoenix/components/core/overlay/ModalContext";
import type { SizeValue } from "@phoenix/types/sizing";
import { classNames } from "@phoenix/utils/classNames";

/**
 * Resolve a {@link SizeValue} to pixels using the current viewport width.
 */
function resolveToPixels(value: SizeValue): number {
  if (typeof value === "number") return value;
  return (parseFloat(value) / 100) * window.innerWidth;
}

const DEFAULT_SIZE: SizeValue = "35%";
const DEFAULT_MIN_SIZE: SizeValue = "35%";
// Always leave 5% of the viewport visible so users can click through to
// dismiss the slideover.
const DEFAULT_MAX_SIZE: SizeValue = "95%";
// Absolute pixel floor — the slideover never shrinks below this regardless
// of what the percentage resolves to on a small viewport.
const HARD_MIN_SIZE_PX = 320;
const RESIZE_HANDLE_WIDTH_PX = 4;

const modalSlideover = keyframes`
  from {
    transform: translateX(100%);
  }
  to {
    transform: translateX(0);
  }
    `;
const modalFade = keyframes`
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
  `;
const modalZoom = keyframes`
  from {
    transform: scale(0.8);
  }
  to {
    transform: scale(1);
  }
  `;
const modalCSS = css`
  --modal-width: var(--global-modal-width-M);

  &[data-size="S"] {
    --modal-width: var(--global-modal-width-S);
  }

  &[data-size="M"] {
    --modal-width: var(--global-modal-width-M);
  }

  &[data-size="L"] {
    --modal-width: var(--global-modal-width-L);
  }

  &[data-size="fullscreen"] {
    --modal-width: var(--global-modal-width-FULLSCREEN);
  }

  &[data-variant="slideover"] {
    --visual-viewport-height: 100vh;
    width: var(--modal-width);
    height: var(--visual-viewport-height);
    position: fixed;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
    top: 0;
    right: 0;
    left: auto;
    align-items: flex-start;
    justify-content: flex-end;

    &[data-entering] {
      animation: ${modalSlideover} 300ms;
    }

    &[data-exiting] {
      animation: ${modalSlideover} 300ms reverse ease-in;
    }

    .react-aria-Dialog {
      height: 100%;
      border-radius: 0;
      border-left-color: var(--global-border-color-default);
      border-top: none;
      border-bottom: none;
      border-right: none;
    }
  }

  &[data-variant="default"] {
    &[data-entering] {
      animation: ${modalFade} 200ms;
    }

    &[data-exiting] {
      animation: ${modalFade} 200ms reverse ease-in;
    }

    .react-aria-Dialog {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      z-index: 1001;
      // 90% gives a decent amount of padding around the dialog when it would
      // otherwise be cut off by the edges of the screen
      max-height: calc(100% - var(--global-dimension-size-800));
      overflow: auto;
      // prevent bounce in safari when scrolling
      overscroll-behavior: contain;

      &[data-entering] {
        animation: ${modalZoom} 300ms cubic-bezier(0.175, 0.885, 0.32, 1.275);
      }
    }
  }

  &[data-resizable="true"] {
    .modal__resize-handle {
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

    .modal__resize-handle:hover,
    .modal__resize-handle[data-dragging="true"] {
      background-color: var(--global-border-color-default);
    }

    &[data-dragging="true"] {
      user-select: none;
    }
  }

  .react-aria-Dialog {
    box-shadow: 0 8px 20px rgba(0 0 0 / 0.1);
    width: var(--modal-width);
    border-radius: var(--global-rounding-medium);
    background: var(--global-background-color-default);
    color: var(--global-text-color-900);
    border: 1px solid var(--global-border-color-default);
    outline: none;

    & .dialog__header {
      position: sticky;
      top: 0;
      z-index: 1;
    }
  }
`;

export type ModalSize = "S" | "M" | "L" | "fullscreen";

type BaseModalProps = AriaModalOverlayProps & {
  size?: ModalSize;
};

type DefaultVariantProps = {
  variant?: "default";
  isResizable?: never;
  defaultSize?: never;
  minSize?: never;
  maxSize?: never;
  onResize?: never;
};

type NonResizableSlideoverProps = {
  variant: "slideover";
  isResizable?: false;
  defaultSize?: never;
  minSize?: never;
  maxSize?: never;
  onResize?: never;
};

type ResizableSlideoverProps = {
  variant: "slideover";
  isResizable: true;
  /** Initial size. Pixels (number) or percentage of viewport (e.g. "35%"). */
  defaultSize?: SizeValue;
  /** Minimum size. Pixels (number) or percentage of viewport (e.g. "50%"). */
  minSize?: SizeValue;
  /** Maximum size. Pixels (number) or percentage of viewport (e.g. "95%"). */
  maxSize?: SizeValue;
  /**
   * Fires on every rAF-throttled drag update and on drag end with the
   * current width as a viewport percentage (e.g. 50 for 50%). Pair with
   * the `useDefaultModalSize` hook to persist size between visits.
   */
  onResize?: (sizePercent: number) => void;
};

export type ModalProps = BaseModalProps &
  (DefaultVariantProps | NonResizableSlideoverProps | ResizableSlideoverProps);

function Modal({ ref, ...props }: ModalProps & { ref?: Ref<HTMLDivElement> }) {
  if (props.variant === "slideover" && props.isResizable) {
    return <ResizableSlideoverModal {...props} ref={ref} />;
  }

  const {
    variant = "default",
    size = "M",
    isResizable: _isResizable,
    ...rest
  } = props;

  return (
    <AriaModal
      {...rest}
      data-size={size}
      data-variant={variant}
      ref={ref}
      css={modalCSS}
    />
  );
}

function ResizableSlideoverModal({
  ref,
  defaultSize,
  minSize,
  maxSize,
  onResize,
  // Discarded — width is driven by the drag handle below, so `size` has no
  // effect and `variant`/`isResizable` are discriminants, not render props.
  size: _size,
  variant: _variant,
  isResizable: _isResizable,
  children,
  ...ariaRest
}: BaseModalProps & ResizableSlideoverProps & { ref?: Ref<HTMLDivElement> }) {
  const resolvedMinSize = minSize ?? DEFAULT_MIN_SIZE;
  const resolvedMaxSize = maxSize ?? DEFAULT_MAX_SIZE;

  /** Resolve min to pixels, enforcing the hard pixel floor. */
  const resolveMin = () =>
    Math.max(resolveToPixels(resolvedMinSize), HARD_MIN_SIZE_PX);

  /** Resolve max to pixels, capped by the viewport width so the slideover
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
    const initialPx = resolveToPixels(defaultSize ?? DEFAULT_SIZE);
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
    // Slideover is pinned to the right edge — dragging left (negative delta)
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

  const minPx = resolveMin();
  const maxPx = resolveMax();

  const style = {
    "--modal-width": `${sizePercent}vw`,
    minWidth: `${minPx}px`,
  } as CSSProperties;

  return (
    <AriaModal
      {...ariaRest}
      data-variant="slideover"
      data-resizable="true"
      data-dragging={isDragging ? "true" : undefined}
      style={style}
      ref={ref}
      css={modalCSS}
    >
      {(renderValues) => (
        <>
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize panel"
            aria-valuenow={Math.round(sizePercent)}
            aria-valuemin={Math.round((minPx / window.innerWidth) * 100)}
            aria-valuemax={Math.round((maxPx / window.innerWidth) * 100)}
            className="modal__resize-handle"
            data-dragging={isDragging ? "true" : undefined}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          />
          <ModalContext.Provider value={RESIZABLE_MODAL_CONTEXT}>
            {typeof children === "function" ? children(renderValues) : children}
          </ModalContext.Provider>
        </>
      )}
    </AriaModal>
  );
}

const modalOverlayCSS = css`
  position: fixed;
  inset: 0;
  background: var(--global-overlay-backdrop-color);
  z-index: 1000;

  &[data-entering] {
    // ensure overlay animation is longer than child animations
    animation: ${modalFade} 300ms;
  }

  &[data-exiting] {
    // ensure overlay animation is longer than child animations
    animation: ${modalFade} 300ms reverse ease-in;
  }
`;

function ModalOverlay({
  ref,
  ...props
}: AriaModalOverlayProps & { ref?: Ref<HTMLDivElement> }) {
  return (
    <AriaModalOverlay
      {...props}
      data-testid="modal-overlay"
      css={modalOverlayCSS}
      className={classNames(props.className, "react-aria-ModalOverlay")}
      // default to true, but allow for override
      isDismissable={props.isDismissable ?? true}
      ref={ref}
    />
  );
}

export { Modal, ModalOverlay };
