import { css } from "@emotion/react";

import { validationBadgeGrowIn } from "@phoenix/components/core/alert";
import { counterCSS } from "@phoenix/components/core/counter/Counter";
import { APP_PORTALED_OVERLAY_Z_INDEX } from "@phoenix/components/core/zIndex";

/**
 * The popover surface shared by every floating element the filter field
 * shows — the typeahead menu, its info panel, and the error popover — so
 * they all read as the same surface
 */
export const popoverSurfaceCSS = css`
  background-color: var(--global-popover-background-color);
  border: 1px solid var(--global-popover-border-color);
  border-radius: var(--global-rounding-small);
  box-shadow: 0 8px 16px var(--global-overlay-shadow-color);
`;

/**
 * Shared CodeMirror autocomplete menu and info-panel chrome.
 *
 * Applied globally, because `typeaheadTooltips` renders the menu into
 * `document.body` rather than under any of its editors' wrappers. Every rule
 * is scoped to the `dsl-filter-typeahead` class the typeahead surfaces ask
 * for, so other editors' menus are untouched.
 */
/**
 * Completion `type` values spelled with this prefix are row classes: the menu
 * chrome in `typeaheadMenuCSS` below styles them, and `optionClass` passes
 * them through unchanged.
 */
export const TYPEAHEAD_COMPLETION_CLASS_PREFIX = "typeahead-completion--";

export function toTypeaheadCompletionClass(type: string | undefined): string {
  return (type ?? "")
    .split(" ")
    .filter((name) => name.startsWith(TYPEAHEAD_COMPLETION_CLASS_PREFIX))
    .join(" ");
}

export const typeaheadMenuCSS = css`
  .cm-tooltip.cm-tooltip-autocomplete.dsl-filter-typeahead {
    ${popoverSurfaceCSS}
    padding: var(--global-dimension-size-50);
    z-index: ${APP_PORTALED_OVERLAY_Z_INDEX};
    /* CodeMirror anchors the tooltip to the text line inside the field, so
       the offset must clear the field's inner padding and border before it
       reads as a gap below the input itself. A transform (rather than
       margin) keeps CodeMirror's own positioning math untouched;
       typeaheadTooltips insets the space it measures against by the same
       amount so a menu at the viewport edge still fits. */
    --menu-gap: var(--typeahead-menu-gap, var(--global-dimension-size-200));
    transform: translateY(var(--menu-gap));
    &.cm-tooltip-above {
      transform: translateY(calc(-1 * var(--menu-gap)));
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
    li.dsl-filter-suggestion .cm-completionLabel,
    li.typeahead-completion--idea .cm-completionDetail {
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
    /* A row for something the record does not supply — kept in the menu so
       its absence is visible, dimmed so the absence reads. */
    li.typeahead-completion--unset {
      color: var(--global-text-color-300);
    }
    /* A container row: the chevron says the row can be drilled with a dot. */
    li.typeahead-completion--container .cm-completionLabel::after {
      content: " ›";
      color: var(--global-text-color-500);
    }
    /* A path-field idea leads with what it reaches, in prose, and keeps the
       path it writes beside it in code. */
    li.typeahead-completion--idea-first .cm-completionLabel {
      font-family: var(--global-font-family-sans);
    }
    li.typeahead-completion--idea-first .cm-completionDetail {
      font-family: var(--global-font-family-mono);
    }
    /* What a fan-out does with what it reads, said in prose */
    li.typeahead-completion--fan-out .cm-completionDetail {
      font-family: var(--global-font-family-sans);
    }
    /* How many members a container row holds */
    .typeahead-completion-count {
      ${counterCSS}
      flex: none;
      margin-left: auto;
    }
    /* Beside a detail it sits close, rather than a whole column away */
    .cm-completionDetail + .typeahead-completion-count {
      margin-left: calc(
        var(--global-dimension-size-100) - var(--global-dimension-size-300)
      );
    }
    /* The chevron a row with a submenu ends in, as the app's menus draw it */
    .typeahead-completion-chevron {
      display: flex;
      flex: none;
      width: 1em;
      height: 1em;
      font-size: 1.2em;
      margin-left: auto;
      color: var(--global-text-color-700);
      svg {
        fill: currentColor;
        width: 1em;
        height: 1em;
      }
    }
    .cm-completionDetail + .typeahead-completion-chevron,
    .typeahead-completion-count + .typeahead-completion-chevron {
      margin-left: calc(
        var(--global-dimension-size-50) - var(--global-dimension-size-300)
      );
    }
    /* The pointer resting on a path-field row is what opens its side
       panel; the layer that notices sits over the whole row */
    & > ul > li:has(.evaluator-path-hover-target) {
      position: relative;
    }
    .evaluator-path-hover-target {
      position: absolute;
      inset: 0;
    }
    /* Details that read as prose rather than as a value */
    li.typeahead-completion--empty .cm-completionDetail,
    li.typeahead-completion--unset .cm-completionDetail,
    li.typeahead-completion--hint .cm-completionDetail {
      font-family: var(--global-font-family-sans);
      font-style: italic;
      color: var(--global-text-color-300);
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
    /* The info panel shown beside the highlighted completion */
    & .cm-tooltip.cm-completionInfo {
      ${popoverSurfaceCSS}
      font-family: var(--global-font-family-sans);
      font-size: var(--global-font-size-s);
      padding: var(--global-dimension-size-100);
      color: var(--global-text-color-700);
      max-width: 300px;
    }
    /* The path field's side panel: a submenu of the level below a row, or a
       longer look at the value one reads. It is set like the menu itself. */
    & .cm-tooltip.cm-completionInfo:has(.evaluator-path-panel) {
      padding: var(--global-dimension-size-50);
      white-space: normal;
    }
    .evaluator-path-panel {
      position: relative;
      display: flex;
      flex-direction: column;
      gap: var(--global-dimension-size-50);
      min-width: 200px;
    }
    /* A level deeper, beside the row of the panel that opened it. It clears
       that panel's border, and the menu's padding around the first panel. */
    .evaluator-path-panel--nested {
      ${popoverSurfaceCSS}
      position: absolute;
      left: 100%;
      z-index: 1;
      width: max-content;
      max-width: 400px;
      padding: var(--global-dimension-size-50);
      margin-left: calc(1px + var(--global-dimension-size-50));
      &.evaluator-path-panel--left {
        left: auto;
        right: 100%;
        margin-left: 0;
        margin-right: calc(1px + var(--global-dimension-size-50));
      }
    }
    .cm-completionInfo > .evaluator-path-panel > .evaluator-path-panel--nested {
      margin-left: calc(2px + 2 * var(--global-dimension-size-50));
      &.evaluator-path-panel--left {
        margin-left: 0;
        margin-right: calc(2px + 2 * var(--global-dimension-size-50));
      }
    }
    .evaluator-path-panel__note {
      padding: var(--global-dimension-size-50) var(--global-dimension-size-100)
        0;
      font-size: var(--global-font-size-xs);
      color: var(--global-text-color-500);
    }
    .evaluator-path-panel__preview {
      padding: var(--global-dimension-size-50) var(--global-dimension-size-100);
      display: -webkit-box;
      -webkit-line-clamp: 4;
      -webkit-box-orient: vertical;
      overflow: hidden;
      overflow-wrap: anywhere;
    }
    .evaluator-path-panel__rows {
      list-style: none;
      margin: 0;
      padding: 0;
      max-height: 320px;
      overflow-y: auto;
      font-size: var(--global-font-size-s);
      line-height: var(--global-line-height-s);
      & > li {
        display: flex;
        align-items: center;
        gap: var(--global-dimension-size-300);
        padding: var(--global-dimension-size-50)
          var(--global-dimension-size-100);
        border-radius: var(--global-rounding-small);
        color: var(--global-text-color-900);
        cursor: pointer;
        &:hover,
        &[data-open] {
          background-color: var(--global-menu-item-background-color-hover);
        }
      }
    }
  }
`;

export const dslFilterCodeMirrorCSS = css`
  flex: 1 1 auto;
  /* A long expression must scroll inside the editor, not push the field's
     controls out of view — without this the flex item's auto minimum is
     the full content width */
  min-width: 0;
  .cm-scroller {
    /* This is a single-line input, so keep long conditions horizontally
       scrollable without letting scrollbar chrome consume vertical space and
       create a second, unintended scroll axis. Caret movement, keyboard, and
       trackpad scrolling still move the horizontal scrollport. */
    overflow-x: auto;
    overflow-y: hidden;
    scrollbar-width: none;
    &::-webkit-scrollbar {
      display: none;
    }
  }
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
 * The grow-in the filter's badges and clear button share, re-exported from the
 * badge that defines it so composed badges (e.g. the AI-query ones) keep
 * importing it from here.
 */
export const dslFilterBadgeGrowIn = validationBadgeGrowIn;

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
