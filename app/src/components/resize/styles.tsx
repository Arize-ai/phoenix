import { css } from "@emotion/react";

export const resizeHandleCSS = css`
  transition: 250ms linear all;
  background-color: var(--global-color-grey-200);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1.8px;
  --resize-handle-size: 8px;
  --resize-icon-width: 24px;
  --resize-icon-height: 2px;
  outline: none;
  &[data-panel-group-direction="vertical"] {
    height: var(--resize-handle-size);
    flex-direction: column;
    &:before,
    &:after {
      width: var(--resize-icon-width);
      height: var(--resize-icon-height);
    }
  }
  &[data-panel-group-direction="horizontal"] {
    width: var(--resize-handle-size);
    flex-direction: row;
    &:before,
    &:after {
      width: var(--resize-icon-height);
      height: var(--resize-icon-width);
    }
  }

  &:hover {
    background-color: var(--global-color-grey-300);
    border-radius: 4px;
    &:before,
    &:after {
      background-color: var(--global-color-primary);
    }
  }

  &:before,
  &:after {
    content: "";
    color: var(--color-solid-resize-bar);
    flex: 0 0 1rem;
    border-radius: 6px;
    background-color: var(--global-color-grey-300);
    flex: none;
  }
`;

export const compactResizeHandleCSS = css`
  transition: 250ms linear all;
  background-color: var(--global-color-grey-200);
  --resize-handle-size: 4px;
  outline: none;
  &[data-panel-group-direction="vertical"] {
    height: var(--resize-handle-size);
  }
  &[data-panel-group-direction="horizontal"] {
    width: var(--resize-handle-size);
  }

  &:hover {
    background-color: var(--global-color-primary);
  }
`;
