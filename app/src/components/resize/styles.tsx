import { css } from "@emotion/react";

export const resizeHandleCSS = css`
  transition: 250ms linear all;
  background-color: var(--global-resize-handle-background-color);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1.8px;
  --resize-handle-size: 8px;
  --resize-icon-width: 24px;
  --resize-icon-height: 2px;
  outline: none;
  &[aria-orientation="horizontal"] {
    height: var(--resize-handle-size);
    flex-direction: column;
    &:before,
    &:after {
      width: var(--resize-icon-width);
      height: var(--resize-icon-height);
    }
  }
  &[aria-orientation="vertical"] {
    width: var(--resize-handle-size);
    flex-direction: row;
    &:before,
    &:after {
      width: var(--resize-icon-height);
      height: var(--resize-icon-width);
    }
  }

  &:hover {
    background-color: var(--global-resize-handle-background-color-hover);
    border-radius: 4px;
    &:before,
    &:after {
      background-color: var(--global-resize-handle-indicator-color-hover);
    }
  }

  &:before,
  &:after {
    content: "";
    flex: none;
    border-radius: 6px;
    background-color: var(--global-resize-handle-indicator-color);
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
