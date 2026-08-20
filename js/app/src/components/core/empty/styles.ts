import { css } from "@emotion/react";

/**
 * The subtle, theme-aware text treatment shared by {@link Empty} and
 * {@link CompactEmptyState}: a muted grey — a touch darker in light mode
 * (text-500) than dark (text-400), where 400 already reads well — at 0.8
 * opacity. Applied to a container; any descendant `.text` (e.g. a `<Text>`)
 * inherits the color, as does an `<Icon>` via `currentColor`.
 */
export const subtleEmptyTextCSS = css`
  opacity: 0.8;
  color: var(--global-text-color-500);
  .theme--dark & {
    color: var(--global-text-color-400);
  }
  .text {
    color: inherit;
  }
`;
