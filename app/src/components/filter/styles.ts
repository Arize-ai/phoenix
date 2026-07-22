import { css, keyframes } from "@emotion/react";

import { NON_MODAL_FLOATING_Z_INDEX } from "@phoenix/components/core/zIndex";

/**
 * The popover surface shared by every floating element the filter field
 * shows — the typeahead menu, its info panel, and the error popover — so
 * they all read as the same surface
 */
const popoverSurfaceCSS = css`
  background-color: var(--global-popover-background-color);
  border: 1px solid var(--global-popover-border-color);
  border-radius: var(--global-rounding-small);
  box-shadow: 0 8px 16px var(--global-overlay-shadow-color);
`;

export const dslFilterCodeMirrorCSS = css`
  flex: 1 1 auto;
  .cm-content {
    padding: var(--global-dimension-size-100) 0;
  }
  .cm-editor {
    background-color: transparent !important;
  }
  .cm-focused {
    outline: none;
  }
  .cm-selectionLayer .cm-selectionBackground {
    background: var(--global-color-cyan-400) !important;
  }
  /* Restyle the autocomplete tooltip as a design-system menu */
  .cm-tooltip.cm-tooltip-autocomplete.dsl-filter-typeahead {
    ${popoverSurfaceCSS}
    padding: var(--global-dimension-size-50);
    z-index: ${NON_MODAL_FLOATING_Z_INDEX};
    /* CodeMirror anchors the tooltip to the text line inside the field, so
       the offset must clear the field's inner padding and border before it
       reads as a gap below the input itself. A transform (rather than
       margin) keeps CodeMirror's own tooltip measurement and positioning
       math untouched. */
    transform: translateY(var(--global-dimension-size-200));
    &.cm-tooltip-above {
      transform: translateY(calc(-1 * var(--global-dimension-size-200)));
    }
    & > ul {
      font-family: var(--global-font-family-sans);
      font-size: var(--global-font-size-s);
      line-height: var(--global-line-height-s);
      max-height: 400px;
      min-width: 280px;
      max-width: 560px;
      & > completion-section {
        display: list-item;
        padding: var(--global-dimension-size-100)
          var(--global-dimension-size-100) var(--global-dimension-size-50);
        font-size: var(--global-font-size-xs);
        font-weight: var(--font-weight-heavy);
        color: var(--global-text-color-500);
        border-bottom: none;
        opacity: 1;
      }
      & > li {
        display: flex;
        align-items: center;
        /* Guaranteed minimum separation between the option label and the
           right-aligned DSL preview, even when both are long */
        gap: var(--global-dimension-size-300);
        padding: var(--global-dimension-size-50)
          var(--global-dimension-size-100);
        border-radius: var(--global-rounding-small);
        color: var(--global-text-color-900);
        cursor: pointer;
        &:hover {
          background-color: var(--global-menu-item-background-color-hover);
        }
        &[aria-selected] {
          background-color: var(--global-menu-item-background-color-hover);
          color: var(--global-text-color-900);
        }
      }
    }
    .cm-completionLabel {
      font-family: var(--global-font-family-mono);
      /* An option label can be an arbitrarily long expression (e.g. a
         recent search) — truncate rather than wrap or overflow so every
         row stays one line */
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    li.dsl-filter-suggestion .cm-completionLabel {
      font-family: var(--global-font-family-sans);
    }
    .cm-completionMatchedText {
      text-decoration: none;
      font-weight: var(--font-weight-heavy);
      color: var(--global-color-primary);
    }
    .cm-completionDetail {
      margin-left: auto;
      font-style: normal;
      font-family: var(--global-font-family-mono);
      font-size: var(--global-font-size-xs);
      color: var(--global-text-color-500);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      max-width: 60%;
      flex: 0 1 auto;
    }
  }
  /* The info panel shown beside the highlighted completion */
  .cm-tooltip.cm-completionInfo {
    ${popoverSurfaceCSS}
    font-family: var(--global-font-family-sans);
    font-size: var(--global-font-size-s);
    padding: var(--global-dimension-size-100);
    color: var(--global-text-color-700);
    max-width: 300px;
  }
`;

/**
 * Styles the validation error tooltip (opened from the in-field error
 * indicator) to match the typeahead menu, so the field's floating surfaces
 * all read as one family
 */
export const dslFilterErrorTooltipCSS = css`
  ${popoverSurfaceCSS}
  padding: var(--global-dimension-size-100) var(--global-dimension-size-150);
  max-width: 400px;
`;

/**
 * Grows the error badge out from the editor's right edge. Animating
 * max-width alongside opacity keeps the appearance smooth — the editor
 * cedes the space gradually instead of the badge popping in at full size.
 */
const errorBadgeIn = keyframes`
  from {
    opacity: 0;
    max-width: 0;
    padding-left: 0;
    padding-right: 0;
  }
`;

export const dslFilterFieldCSS = css`
  flex: 1 1 auto;
  border-width: var(--global-border-size-thin);
  border-style: solid;
  border-color: var(--global-input-field-border-color);
  border-radius: var(--global-rounding-small);
  background-color: var(--global-input-field-background-color);
  transition: all 0.2s ease-in-out;
  overflow-x: hidden;
  &:hover,
  &[data-is-focused="true"] {
    border-color: var(--global-input-field-border-color-active);
  }
  /* Flag invalidity only once the user has left the field — a red border
     while they're still typing/fixing the expression is too alarming */
  &[data-is-invalid="true"]:not([data-is-focused="true"]) {
    border-color: var(--global-color-danger);
  }
  box-sizing: border-box;
  .filter-icon {
    margin-left: var(--global-dimension-size-100);
    margin-right: var(--global-dimension-size-50);
  }
  .error-badge {
    display: flex;
    align-items: center;
    gap: var(--global-dimension-size-50);
    max-width: 200px;
    overflow: hidden;
    padding: 2px var(--global-dimension-size-65);
    margin-right: var(--global-dimension-size-50);
    border-radius: var(--global-rounding-small);
    background-color: var(--global-color-danger-100);
    color: var(--global-color-danger);
    font-size: var(--global-font-size-xs);
    line-height: var(--global-line-height-xs);
    white-space: nowrap;
    cursor: default;
    animation: ${errorBadgeIn} 0.25s ease-out;
    @media (prefers-reduced-motion: reduce) {
      animation: none;
    }
    .icon-wrap {
      flex-shrink: 0;
    }
    &:focus-visible {
      outline: 1px solid var(--global-input-field-border-color-active);
      outline-offset: 1px;
    }
  }
  .error-badge__message {
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .clear-button {
    margin-right: var(--global-dimension-size-100);
    padding: 2px;
    color: var(--global-text-color-700);
    border-radius: var(--global-rounding-small);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    visibility: hidden;
    &:hover {
      color: var(--global-text-color-900);
      background-color: var(--global-color-gray-300);
    }
    &:focus-visible {
      outline: 1px solid var(--global-input-field-border-color-active);
      outline-offset: 1px;
    }
  }
  &[data-has-condition="true"] .clear-button {
    visibility: visible;
  }
`;
