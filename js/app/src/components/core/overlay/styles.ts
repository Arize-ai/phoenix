import { css } from "@emotion/react";

export const popoverSurfaceCSS = css`
  box-sizing: border-box;
  --background-color: var(--global-popover-background-color);
  border: 1px solid var(--global-popover-border-color);
  box-shadow: 0px 8px 16px var(--global-overlay-shadow-color);
  border-radius: var(--global-rounding-small);
  background: var(--background-color);
  color: var(--global-text-color-900);
  outline: none;
`;
