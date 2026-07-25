import { css } from "@emotion/react";

export const resizeHandleCSS = css`
  transition: 250ms linear all;
  background-color: var(--global-resize-handle-background-color);
  --resize-handle-size: 3px;
  outline: none;
  &[aria-orientation="horizontal"] {
    height: var(--resize-handle-size);
  }
  &[aria-orientation="vertical"] {
    width: var(--resize-handle-size);
  }

  &:hover,
  &:active {
    background-color: var(--global-resize-handle-indicator-color-hover);
  }
`;

/**
 * A resize handle that is invisible at rest and on hover — the resize cursor
 * is the only hover affordance — and only shows its indicator color while
 * dragging or keyboard-focused. Use where a persistent divider line would add
 * visual noise.
 */
export const transparentResizeHandleCSS = css`
  ${resizeHandleCSS};
  background-color: transparent;
  &:hover {
    background-color: transparent;
  }
  &:active,
  &:focus-visible {
    background-color: var(--global-resize-handle-indicator-color-hover);
  }
`;

export const compactResizeHandleCSS = css`
  transition: 250ms linear all;
  background-color: var(--global-resize-handle-background-color);
  --resize-handle-size: 1px;
  outline: none;
  &[aria-orientation="horizontal"] {
    height: var(--resize-handle-size);
  }
  &[aria-orientation="vertical"] {
    width: var(--resize-handle-size);
  }

  &:hover,
  &:active {
    background-color: var(--global-resize-handle-indicator-color-hover);
  }
`;

/**
 * Makes a vertical resize handle's pointer target visible while preserving its
 * one-pixel layout width. The target extends size-100 to the left and size-150
 * to the right of the handle.
 */
export const diagnosticResizeHandleCSS = css`
  --resize-handle-hit-area-left: var(--global-dimension-size-100);
  --resize-handle-hit-area-right: var(--global-dimension-size-150);
  position: relative;
  overflow: visible;
  background: transparent;

  &::before {
    content: "";
    position: absolute;
    z-index: var(--global-z-index-local-base);
    top: 0;
    bottom: 0;
    left: calc(-1 * var(--resize-handle-hit-area-left));
    right: calc(-1 * var(--resize-handle-hit-area-right));
    background: rgb(0 255 0 / 15%);
    cursor: ew-resize;
  }

  &::after {
    content: "";
    position: absolute;
    z-index: var(--global-z-index-local-raised);
    top: 0;
    bottom: 0;
    left: 0;
    width: var(--global-border-size-thin);
    background: #ff00ff;
    pointer-events: none;
  }

  &:hover,
  &:active,
  &[data-dragging="true"] {
    background: transparent;
  }
`;
