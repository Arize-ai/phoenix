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
