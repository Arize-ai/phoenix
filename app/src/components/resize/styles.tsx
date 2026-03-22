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
