import { css } from "@emotion/react";

/**
 * A picker popover with a search field above its list. The list box alone
 * inherits the popover's max-height, so with a header above it the last rows
 * paint past the popover's edge; a flex column shares the height instead, the
 * way the table column selector does.
 */
export const searchablePickerMenuCSS = css`
  display: flex;
  flex-direction: column;
  max-height: inherit;
  min-height: 0;
`;

export const searchablePickerListCSS = css`
  flex: 1 1 auto;
  min-height: 0;
  max-height: none;
`;

/** Wraps a source menu (a prompt or decision picker) so it shrinks before its neighbours. */
export const sourceMenuContainerCSS = css`
  min-width: 0;
  flex: 0 1 auto;
  overflow: hidden;
  display: flex;
`;

/**
 * Width strategy for a source menu's trigger:
 *
 * - min-width: Ensures the button is always usably wide
 * - max-width (placeholder): Prevents "Select prompt" from stretching too wide
 * - max-width (selected): Uncapped, allows button to use available space
 * - text max-width: Truncates long names with ellipsis
 *
 * The button uses flex: 1 1 auto so it grows/shrinks within these bounds.
 */
export const sourceMenuTriggerCSS = css`
  --button-min-width: var(--global-dimension-size-1800);
  --button-max-width-placeholder: var(--global-dimension-size-2400);
  --text-max-width: 30ch;
  justify-content: space-between;
  flex: 1 1 auto;
  min-width: var(--button-min-width);
  max-width: var(--button-max-width-placeholder);
  overflow: hidden;
  &[data-has-selection] {
    max-width: none;
  }
`;
