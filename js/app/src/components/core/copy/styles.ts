import { css } from "@emotion/react";

/**
 * The edge length of an embedded copy button, as a custom property, so a layout
 * can align itself to the control without depending on the styling that draws
 * it. Included in {@link embeddedCopyButtonCSS}; apply it on its own where a
 * container measures against the button but leaves its appearance alone.
 */
export const embeddedCopyButtonSizeCSS = css`
  --embedded-copy-button-size: calc(
    var(--global-input-height-m) - 2 * var(--global-dimension-size-125) +
      var(--global-dimension-size-50)
  );
`;

/**
 * The subtle embedded copy button used wherever a copy control sits on top of
 * content it belongs to — a readonly field, a code block, a table cell. Matches
 * CopyInput's button: a small gray square, quiet enough that the content beside
 * it still reads first, and short enough to fit a single line of text.
 *
 * Apply on a container holding a CopyToClipboardButton; positioning is up to
 * the caller.
 */
export const embeddedCopyButtonCSS = css`
  ${embeddedCopyButtonSizeCSS}
  // The element selector keeps this ahead of the button's own size rule, which
  // is otherwise of equal specificity and would win or lose on style insertion
  // order alone
  .copy-to-clipboard-button button.copy-button {
    width: var(--embedded-copy-button-size);
    height: var(--embedded-copy-button-size);
    min-width: 0;
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: var(--field-copy-button-background-color);
    border: none;
    border-radius: var(--global-rounding-small);
    color: var(--field-copy-button-text-color);
    transition: background-color 0.2s;
    &:hover {
      background-color: var(--field-copy-button-background-color-hover);
    }
  }
`;
