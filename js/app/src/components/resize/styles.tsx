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
