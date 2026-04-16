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
import { classNames } from "@phoenix/utils/classNames";

const DEFAULT_RESIZABLE_WIDTH = 480;
const DEFAULT_RESIZABLE_MIN_WIDTH = 320;
// Leave ~200px of the underlying page visible so users can still click
// through to it when the drawer is dragged as wide as it will go.
const DEFAULT_RESIZABLE_MAX_WIDTH_INSET = 200;
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
  defaultWidth?: never;
  minWidth?: never;
  maxWidth?: never;
  onResize?: never;
};

type NonResizableSlideoverProps = {
  variant: "slideover";
  isResizable?: false;
  defaultWidth?: never;
  minWidth?: never;
  maxWidth?: never;
  onResize?: never;
};

type ResizableSlideoverProps = {
  variant: "slideover";
  isResizable: true;
  defaultWidth?: number;
  minWidth?: number;
  maxWidth?: number;
  /**
   * Fires on every rAF-throttled drag update and on drag end. Pair with the
   * `useDefaultModalWidth` hook to persist width between visits.
   */
  onResize?: (width: number) => void;
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
  defaultWidth,
  minWidth,
  maxWidth,
  onResize,
  // Discarded — width is driven by the drag handle below, so `size` has no
  // effect and `variant`/`isResizable` are discriminants, not render props.
  size: _size,
  variant: _variant,
  isResizable: _isResizable,
  children,
  ...ariaRest
}: BaseModalProps & ResizableSlideoverProps & { ref?: Ref<HTMLDivElement> }) {
  const resolvedMin = minWidth ?? DEFAULT_RESIZABLE_MIN_WIDTH;
  const resolvedMax = Math.max(
    resolvedMin,
    maxWidth ?? window.innerWidth - DEFAULT_RESIZABLE_MAX_WIDTH_INSET
  );

  const [width, setWidth] = useState<number>(
    Math.min(
      Math.max(defaultWidth ?? DEFAULT_RESIZABLE_WIDTH, resolvedMin),
      resolvedMax
    )
  );
  const [isDragging, setIsDragging] = useState(false);

  // Drag-session refs are the source of truth during a drag. Using refs
  // instead of state bypasses React batching (so pointermove handlers never
  // read a stale `isDragging`) and lets us coalesce pointer-rate updates
  // into a single rAF per frame — matches how react-resizable-panels keeps
  // its drag path off the render loop.
  const isDraggingRef = useRef(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);
  const pendingWidthRef = useRef<number | null>(null);
  const rafIdRef = useRef<number | null>(null);

  const clamp = (value: number) =>
    Math.min(Math.max(value, resolvedMin), resolvedMax);

  const flushPendingWidth = () => {
    rafIdRef.current = null;
    if (pendingWidthRef.current == null) return;
    const next = pendingWidthRef.current;
    pendingWidthRef.current = null;
    setWidth(next);
    onResize?.(next);
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    startXRef.current = event.clientX;
    startWidthRef.current = width;
    isDraggingRef.current = true;
    setIsDragging(true);
    event.preventDefault();
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    // Slideover is pinned to the right edge — dragging left (negative delta)
    // increases width; dragging right decreases it.
    const deltaX = event.clientX - startXRef.current;
    pendingWidthRef.current = clamp(startWidthRef.current - deltaX);
    if (rafIdRef.current == null) {
      rafIdRef.current = requestAnimationFrame(flushPendingWidth);
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
    let finalWidth = width;
    if (pendingWidthRef.current != null) {
      finalWidth = pendingWidthRef.current;
      pendingWidthRef.current = null;
      setWidth(finalWidth);
      onResize?.(finalWidth);
    }

    setIsDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const style = { "--modal-width": `${width}px` } as CSSProperties;

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
            aria-valuenow={width}
            aria-valuemin={resolvedMin}
            aria-valuemax={maxWidth}
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
