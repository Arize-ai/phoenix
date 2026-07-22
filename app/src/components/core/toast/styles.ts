import { css, keyframes } from "@emotion/react";

import { PORTALED_OVERLAY_Z_INDEX } from "@phoenix/components/core/zIndex";

/**
 * How far (in px) each stacked toast peeks out from behind the front toast
 * while the stack is collapsed.
 */
const COLLAPSED_PEEK = 16;
/**
 * Vertical gap (in px) between toasts when the stack is expanded (hovered /
 * focused).
 */
const EXPANDED_GAP = 8;
/**
 * Amount each toast is scaled down per step behind the front toast while
 * collapsed (sonner-like depth effect).
 */
const SCALE_STEP = 0.05;

const slideInFromTop = keyframes`
  from {
    opacity: 0;
    transform: translateY(-130%);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
`;

/**
 * The toast region is a fixed, top-centered container that lays out the toast
 * stack. Toasts are absolutely positioned inside it; the region only owns the
 * width and the (animated) height so the hover target tracks the visible stack.
 *
 * `--toast-count` and `--toast-row-height` are written by `attachToastRegion`
 * in `ToastRegion.tsx` once the toasts have been measured.
 */
export const toastRegionCSS = css`
  position: fixed;
  top: var(--global-dimension-size-200);
  left: 50%;
  width: 400px;
  max-width: calc(100vw - var(--global-dimension-size-400));
  transform: translateX(-50%);
  outline: none;
  z-index: ${PORTALED_OVERLAY_Z_INDEX};

  --collapsed-peek: ${COLLAPSED_PEEK}px;
  --expanded-gap: ${EXPANDED_GAP}px;
  --toast-row-height: 72px;
  --toast-count: 1;

  height: calc(
    var(--toast-row-height) + (var(--toast-count) - 1) * var(--collapsed-peek)
  );
  transition: height 300ms cubic-bezier(0.21, 1.02, 0.73, 1);

  &[data-hovered],
  &[data-focused] {
    height: calc(
      var(--toast-stack-height, var(--toast-row-height)) +
        (var(--toast-count) - 1) * var(--expanded-gap)
    );
  }

  /* Expand (un-stack) the toasts when the region is hovered or focused. */
  &[data-hovered] .toast-positioner,
  &[data-focused] .toast-positioner {
    transform: translateY(
      calc(var(--toast-offset, 0px) + var(--toast-index) * var(--expanded-gap))
    );
    opacity: 1;
  }

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`;

/**
 * Wraps each toast and owns its position within the stack. `--toast-index`
 * (0 = front / newest) is set inline by the `Toast` component.
 */
export const toastPositionerCSS = css`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  transform-origin: top center;
  transform: translateY(
      calc(var(--toast-index) * var(--collapsed-peek, ${COLLAPSED_PEEK}px))
    )
    scale(calc(1 - var(--toast-index) * ${SCALE_STEP}));
  opacity: calc(1 - var(--toast-index) * 0.1);
  transition:
    transform 300ms cubic-bezier(0.21, 1.02, 0.73, 1),
    opacity 300ms ease;

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`;

export const toastCSS = css`
  display: flex;
  flex-direction: column;
  gap: var(--global-dimension-size-100);
  padding: var(--global-dimension-size-100) var(--global-dimension-size-100);
  border-radius: 8px;
  outline: none;
  width: 100%;
  box-sizing: border-box;
  position: relative;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  animation: ${slideInFromTop} 280ms cubic-bezier(0.21, 1.02, 0.73, 1);
  --toast-border: 1px solid var(--global-border-color-default);
  --toast-color: var(--global-static-color-900);
  &[data-theme="light"] {
    --toast-border: 1px solid
      lch(from var(--internal-token-color) 88 calc(c * 0.4) h);
    --toast-background-color: lch(
      from var(--internal-token-color) 96 calc(c * 0.3) h
    );
    --toast-color: lch(from var(--internal-token-color) 45 c h);
  }
  &[data-theme="dark"] {
    --toast-border: 1px solid
      lch(from var(--internal-token-color) 28 calc(c * 0.3) h);
    --toast-background-color: lch(
      from var(--internal-token-color) 18 calc(c * 0.2) h
    );
    --toast-color: lch(from var(--internal-token-color) 90 calc(c * 0.8) h);
    backdrop-filter: blur(4px);
  }
  background: var(--toast-background-color);
  background-color: var(--toast-background-color);
  border: var(--toast-border);
  color: var(--toast-color);

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }

  &[data-focus-visible] {
    outline: var(--focus-ring-thickness) solid var(--focus-ring-color);
    outline-offset: var(--focus-ring-offset);
  }

  [slot="close"][data-hovered],
  [slot="close"][data-pressed] {
    background-color: transparent;
    color: inherit;
  }

  .toast-action-container {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    width: 100%;
  }

  .toast-action-button {
    background: transparent;
    border: var(--toast-border);
    color: var(--toast-color);
    outline: none;
    backdrop-filter: blur(10px);

    &:hover,
    &:focus-visible,
    &:active {
      background: var(--toast-background-color);
      background-color: var(--toast-background-color);
    }
  }

  .react-aria-ToastContent {
    display: flex;
    flex-direction: column;
    flex: 1 1 auto;
    min-width: 0px;

    [slot="title"] {
      align-items: center;
      color: var(--toast-color);
      font-weight: bold;
      display: flex;
      flex-direction: row;
      gap: var(--global-dimension-size-50);
    }

    [slot="description"] {
      color: var(--toast-color);
    }
  }
`;
