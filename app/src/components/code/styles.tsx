import { css } from "@emotion/react";

/**
 * The subtle embedded copy button used inside readonly copyable surfaces,
 * matching CopyInput's: a small gray square inset in the field. Apply on a
 * container holding a CopyToClipboardButton; positioning is up to the caller.
 */
export const embeddedCopyButtonCSS = css`
  --embedded-copy-button-size: calc(
    var(--global-input-height-m) - 2 * var(--global-dimension-size-125) +
      var(--global-dimension-size-50)
  );
  .copy-to-clipboard-button .copy-button {
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

/**
 * The readonly-field surface shared by copyable blocks — same background as
 * CopyField/CopyInput, brightening while the contained copy button is hovered
 * or focused so the whole surface reads as one control.
 */
export const copyableSurfaceCSS = css`
  background-color: var(--field-readonly-background-color);
  transition: background-color 0.2s ease-in-out;
  &:has(.copy-to-clipboard-button button:hover),
  &:has(.copy-to-clipboard-button button[data-focus-visible]) {
    background-color: var(--field-readonly-background-color-hover);
  }
`;

/**
 * Shared shell for the read-only *BlockWithCopy components. Styled to match
 * the readonly text field (CopyField + CopyInput) — same surface color, font
 * size, rounding, and hover affordance — so copyable code and copyable text
 * read as one family of controls.
 */
export const codeBlockWithCopyCSS = css`
  position: relative;
  --code-block-min-height: var(--global-input-height-m);
  min-height: var(--code-block-min-height);
  display: flex;
  flex-direction: row;
  align-items: center;
  border-radius: var(--global-rounding-small);
  overflow: hidden;
  ${copyableSurfaceCSS}
  // The global .cm-editor rule paints its background from this variable;
  // transparent lets the field-readonly surface above show through.
  --code-mirror-editor-background-color: transparent;
  .cm-theme,
  .cm-editor {
    width: 100%;
    min-height: var(--code-block-min-height);
    font-size: var(--global-font-size-s);
  }
  .cm-scroller {
    padding: var(--global-dimension-size-100) var(--global-dimension-size-125);
    // Keep the end of the content clear of the overlaid copy button
    padding-right: calc(
      var(--global-dimension-size-50) + var(--global-button-height-s) +
        var(--global-dimension-size-100)
    );
    // Long single-line snippets overflow horizontally; keep the scrollbar
    // subtle so it doesn't dominate a one-line block.
    scrollbar-width: thin;
    scrollbar-color: rgba(var(--global-color-gray-500-rgb), 0.4) transparent;
    &::-webkit-scrollbar {
      width: 6px;
      height: 6px;
    }
    &::-webkit-scrollbar-track {
      background: transparent;
    }
    &::-webkit-scrollbar-thumb {
      background-color: rgba(var(--global-color-gray-500-rgb), 0.4);
      border: none;
      border-radius: 3px;
    }
  }
  .cm-content {
    padding: 0;
  }
  .cm-line {
    padding: 0;
  }
  // Gutters (line numbers, fold arrows) have no use in a read-only copy block
  // and their reserved width breaks start-alignment with adjacent text fields.
  .cm-gutters {
    display: none;
  }
  ${embeddedCopyButtonCSS}
  .copy-to-clipboard-button {
    position: absolute;
    top: calc(
      (var(--code-block-min-height) - var(--embedded-copy-button-size)) / 2
    );
    right: var(--global-dimension-size-125);
    z-index: 1;
  }
`;
