import { css, keyframes } from "@emotion/react";

import { svgSize as pxiGlyphSize } from "@phoenix/components/agent/PxiGlyph";
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

/**
 * Sizes the PxiOutline wrapper like the bare field used to size itself and
 * silences the outline's resting stroke — the field should look untouched
 * until AI search actually engages (a natural-language draft or an
 * in-flight conversion).
 */
export const dslFilterAIOutlineCSS = css`
  flex: 1 1 auto;
  min-width: 0;
  /* The gradient hugs the field's border — the outline's default standoff
     gap reads as a detached double border on an input */
  --pxi-outline-gap: 0px;
  &[data-state="idle"] .pxi-outline__stroke {
    opacity: 0;
  }
  /* While the generative border is showing it is the focus affordance —
     focus brings the band to full strength (the field suppresses its own
     theme focus ring, which would clash with the gradient) */
  &:not([data-state="idle"]):has(.cm-content:focus-visible)
    .pxi-outline__stroke {
    opacity: 1;
  }
  /* The outline isolates its stacking (for the glow layers), which traps
     the typeahead's own z-index inside it — later-stacked page content
     like a table's sticky header would paint over the open dropdown.
     Elevate the whole outline only while a tooltip is showing so the
     field doesn't sit above sibling floating UI the rest of the time. */
  &:has(.cm-tooltip) {
    z-index: ${NON_MODAL_FLOATING_Z_INDEX};
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
  /* In plain-English mode the generative gradient border carries focus
     (brightening to full strength) — the theme ring on top of it reads
     as two clashing borders */
  &[data-ai-mode="true"]:has(.cm-content:focus-visible) {
    outline: none;
  }
  /* When the gradient wraps the field it IS the border — the input's own
     border under it reads as a second, internal ring. Placed after the
     hover/focus border rules so it wins them by source order. */
  &[data-ai-mode="true"] {
    border-color: transparent;
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
  /* The converting glyph keeps the resting glyph's footprint (no layout
     shift) and wears the same thinking tint as the Ask PXI nav button */
  .dsl-filter-condition-field__thinking-glyph {
    display: grid;
    place-items: center;
    flex: none;
    width: ${pxiGlyphSize}px;
    height: ${pxiGlyphSize}px;
    color: color-mix(
      in srgb,
      var(--pxi-treatment-color-middle) 78%,
      var(--pxi-treatment-color-end)
    );
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
    animation: ${errorBadgeIn} 0.25s ease-out;
    @media (prefers-reduced-motion: reduce) {
      animation: none;
    }
  }
  /* Plain-English mode reads as prose, not code — mirror that in the
     editor; the leading PXI glyph (self-colored, subtly animated) marks
     the mode at a glance even while the field is empty */
  &[data-ai-mode="true"] .cm-content {
    font-family: var(--global-font-family-sans);
  }
  /* One treatment spec for the engaged AI controls — the badge and the
     pressed sparkle toggle read as one family, while the neutral buttons
     (gear, clear) stay gray */
  .ai-badge,
  .ai-mode-toggle[aria-pressed="true"] {
    color: var(--pxi-treatment-color-middle);
    border-color: color-mix(
      in srgb,
      var(--pxi-treatment-color-middle) 35%,
      transparent
    );
    background-color: color-mix(
      in srgb,
      var(--pxi-treatment-color-middle) 12%,
      transparent
    );
  }
  .ai-badge {
    display: flex;
    align-items: center;
    flex-shrink: 0;
    gap: var(--global-dimension-size-50);
    padding: 2px var(--global-dimension-size-65);
    border-radius: var(--global-rounding-small);
    border-width: var(--global-border-size-thin);
    border-style: solid;
    font-size: var(--global-font-size-xs);
    line-height: var(--global-line-height-xs);
    white-space: nowrap;
    cursor: default;
    animation: ${errorBadgeIn} 0.25s ease-out;
    @media (prefers-reduced-motion: reduce) {
      animation: none;
    }
  }
  .ai-undo-button {
    display: flex;
    align-items: center;
    gap: var(--global-dimension-size-25);
    padding: 0 var(--global-dimension-size-50);
    border-radius: var(--global-rounding-small);
    color: inherit;
    font-size: var(--global-font-size-xs);
    cursor: pointer;
    &:hover {
      background-color: color-mix(
        in srgb,
        var(--pxi-treatment-color-middle) 18%,
        transparent
      );
    }
    &:focus-visible {
      outline: var(--focus-ring-thickness) solid var(--focus-ring-color);
      outline-offset: var(--focus-ring-offset);
    }
  }
  .ai-mode-toggle[aria-pressed="true"]:hover {
    background-color: color-mix(
      in srgb,
      var(--pxi-treatment-color-middle) 20%,
      transparent
    );
  }
`;
