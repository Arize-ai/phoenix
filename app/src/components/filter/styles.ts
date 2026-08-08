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
  /* A long expression must scroll inside the editor, not push the field's
     controls out of view — without this the flex item's auto minimum is
     the full content width */
  min-width: 0;
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
      /* Wide enough that the longest shipped suggestion snippet (~77 mono
         chars) fits its own stacked line — see li.dsl-filter-suggestion */
      max-width: 640px;
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
    /* A suggestion's detail is a whole example condition, not a short type
       hint — beside the label under the 60% cap it truncates unreadably.
       Stack it full-width under the prose label instead. */
    li.dsl-filter-suggestion {
      flex-direction: column;
      align-items: stretch;
      gap: var(--global-dimension-size-25);
    }
    li.dsl-filter-suggestion .cm-completionDetail {
      margin-left: 0;
      max-width: 100%;
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
  /* The tab-through blanks an inserted snippet leaves behind — CodeMirror's
     default marking is a near-invisible gray, so tint them with the primary
     color to read as "fill me in": the active one is selected for overtyping,
     Tab hops to the next, and the marks clear once the user moves on */
  .cm-snippetField {
    background-color: color-mix(
      in srgb,
      var(--global-color-primary) 18%,
      transparent
    );
    border-radius: var(--global-rounding-small);
  }
  /* The sub-expression a validation error was blamed on */
  .cm-dsl-filter-error-region {
    text-decoration: underline wavy var(--global-color-danger);
    text-underline-offset: 3px;
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
 * Grows a control-cluster badge (error or warning) out from the editor's
 * right edge. Animating max-width alongside opacity keeps the appearance
 * smooth — the editor cedes the space gradually instead of the badge popping
 * in at full size. Exported so composed badges (e.g. the AI-query ones)
 * grow in the same way.
 */
export const dslFilterBadgeGrowIn = keyframes`
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
  &:hover {
    border-color: var(--global-input-field-border-color-active);
  }
  &[data-is-focused="true"] {
    border-color: var(--global-input-field-border-color-active);
  }
  &:has(.cm-content:focus-visible) {
    outline: var(--focus-ring-thickness) solid var(--focus-ring-color);
    outline-offset: calc(-1 * var(--focus-ring-thickness));
  }
  /* Flag invalidity only once the user has left the field — a red border
     while they're still typing/fixing the expression is too alarming */
  &[data-is-invalid="true"]:not([data-is-focused="true"]) {
    border-color: var(--global-color-danger);
  }
  &[data-is-warning="true"]:not([data-is-focused="true"]) {
    border-color: var(--global-color-warning);
  }
  box-sizing: border-box;
  .filter-icon {
    margin-left: var(--global-dimension-size-100);
    margin-right: var(--global-dimension-size-50);
  }
  /* Everything after the editor — badges, the mode toggle, settings, and
     clear — shares one flex group so spacing comes from a single gap
     rather than per-element margins */
  .dsl-filter-condition-field__controls {
    display: flex;
    align-items: center;
    flex: none;
    gap: var(--global-dimension-size-50);
    margin-inline-end: var(--global-dimension-size-100);
  }
  .error-badge {
    display: flex;
    align-items: center;
    gap: var(--global-dimension-size-50);
    max-width: 200px;
    overflow: hidden;
    padding: 2px var(--global-dimension-size-65);
    border-radius: var(--global-rounding-small);
    font-size: var(--global-font-size-xs);
    line-height: var(--global-line-height-xs);
    white-space: nowrap;
    cursor: default;
    animation: ${dslFilterBadgeGrowIn} 0.25s ease-out;
    @media (prefers-reduced-motion: reduce) {
      animation: none;
    }
    &[data-severity="danger"] {
      background-color: var(--global-color-danger-100);
      color: var(--global-color-danger);
    }
    &[data-severity="warning"] {
      background-color: color-mix(
        in srgb,
        var(--global-color-warning) 10%,
        transparent
      );
      color: var(--global-color-warning);
    }
    .icon-wrap {
      flex-shrink: 0;
    }
    &:focus-visible {
      outline: var(--focus-ring-thickness) solid var(--focus-ring-color);
      outline-offset: var(--focus-ring-offset);
    }
  }
  .error-badge__message {
    overflow: hidden;
    text-overflow: ellipsis;
  }
  /* The clear affordance only exists once there is something to clear —
     it leaves the layout entirely (no reserved empty slot) and grows in
     like the badges do when a condition appears */
  .clear-button {
    display: none;
  }
  &[data-has-condition="true"] .clear-button {
    display: flex;
    overflow: hidden;
    /* The grow-in animates max-width, so the resting bounds must be
       interpolable: a fixed max and a free min */
    min-width: 0;
    max-width: var(--global-dimension-size-250);
    animation: ${dslFilterBadgeGrowIn} 0.25s ease-out;
    @media (prefers-reduced-motion: reduce) {
      animation: none;
    }
  }
  /* The prose variant reads as prose, not code — mirror that in the
     editor's font */
  &[data-variant="prose"] .cm-content {
    font-family: var(--global-font-family-sans);
  }
`;
