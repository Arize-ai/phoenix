import { css } from "@emotion/react";

/**
 * Hover invitation for quiet interactive text (click-to-copy IDs, values that
 * reveal a tooltip): a subtle background wash that appears on hover without
 * shifting the text's position. Matches the quiet Button hover treatment.
 */
export const quietHoverCSS = css`
  cursor: pointer;
  border-radius: var(--global-rounding-small);
  padding: var(--global-dimension-size-25) var(--global-dimension-size-50);
  margin: calc(-1 * var(--global-dimension-size-25))
    calc(-1 * var(--global-dimension-size-50));
  transition: background-color 0.2s;
  &:hover,
  &[data-hovered] {
    background-color: var(--hover-background);
  }
`;
