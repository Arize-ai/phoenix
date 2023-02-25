import { css, Theme } from "@emotion/react";

export const resizeHandleCSS = (theme: Theme) => css`
  transition: 250ms linear background-color;
  background-color: ${theme.colors.gray500};
  --px-resize-handle-size: 2px;
  --px-collapsed-resize-handle-size: 8px;
  outline: none;
  &[data-panel-group-direction="vertical"] {
    height: var(--px-resize-handle-size);
    &[aria-valuenow="0"] {
      height: var(--px-collapsed-resize-handle-size);
    }
  }
  &[data-panel-group-direction="horizontal"] {
    width: var(--px-resize-handle-size);
    &[aria-valuenow="0"] {
      width: var(--px-collapsed-resize-handle-size);
    }
  }

  &:hover {
    background-color: ${theme.colors.arizeLightBlue};
  }
`;
