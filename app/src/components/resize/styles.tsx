import { css, Theme } from "@emotion/react";

export const resizeHandleCSS = (theme: Theme) => css`
  transition: 250ms linear all;
  background-color: ${theme.colors.gray600};
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1.8px;
  --px-resize-handle-size: 8px;
  --px-resize-icon-width: 24px;
  --px-resize-icon-height: 2px;
  outline: none;
  &[data-panel-group-direction="vertical"] {
    height: var(--px-resize-handle-size);
    flex-direction: column;
    &:before,
    &:after {
      width: var(--px-resize-icon-width);
      height: var(--px-resize-icon-height);
    }
  }
  &[data-panel-group-direction="horizontal"] {
    width: var(--px-resize-handle-size);
    flex-direction: row;
    &:before,
    &:after {
      width: var(--px-resize-icon-height);
      height: var(--px-resize-icon-width);
    }
  }

  &:hover {
    background-color: ${theme.colors.gray200};
    border-radius: 4px;
    &:before,
    &:after {
      background-color: ${theme.colors.arizeLightBlue};
    }
  }

  &:before,
  &:after {
    content: "";
    color: var(--color-solid-resize-bar);
    flex: 0 0 1rem;
    border-radius: 6px;
    background-color: ${theme.colors.gray100};
    flex: none;
  }
`;

export const compactResizeHandleCSS = (theme: Theme) => css`
  transition: 250ms linear all;
  background-color: ${theme.colors.gray600};
  --px-resize-handle-size: 4px;
  outline: none;
  &[data-panel-group-direction="vertical"] {
    height: var(--px-resize-handle-size);
  }
  &[data-panel-group-direction="horizontal"] {
    width: var(--px-resize-handle-size);
  }

  &:hover {
    background-color: ${theme.colors.arizeLightBlue};
  }
`;
