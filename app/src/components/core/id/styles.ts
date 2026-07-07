import { css } from "@emotion/react";

/**
 * How long the "copied" (checkmark) affordance stays visible after a copy.
 */
export const SHOW_COPIED_TIMEOUT_MS = 2000;

/**
 * Wraps the copy button so the full ID can be surfaced via a native `title`
 * tooltip (react-aria's Button does not accept a `title` prop). Kept inline so
 * it does not affect the badge's layout.
 */
export const copyableBadgeWrapperCSS = css`
  display: inline-flex;
`;

/**
 * Resets the native button chrome so an interactive copy affordance can render
 * as an inline badge while remaining a real, focusable button.
 */
export const copyableBadgeButtonCSS = css`
  appearance: none;
  margin: 0;
  padding: 0;
  border: none;
  background: none;
  font: inherit;
  color: inherit;
  cursor: pointer;
  display: inline-flex;
  outline: none;

  &[data-focus-visible] {
    outline: 1px solid var(--global-input-field-border-color-active);
    outline-offset: 1px;
    border-radius: var(--global-rounding-small);
  }
`;

/**
 * Applied to the icon in the icon-only (`showValue={false}`) variant. The icon
 * fills a value-height line box -- matching the `Text size="S"` line-height that
 * sizes the labeled variant -- so both variants render at the same height. The
 * icon glyph is smaller than the line box, so it is centered within it.
 */
export const copyableBadgeIconOnlyCSS = css`
  min-height: var(--global-line-height-s);
  align-items: center;
`;
