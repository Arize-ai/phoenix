import { css } from "@emotion/react";

import { svgSize as glyphSize } from "@phoenix/components/agent/PxiGlyph";
import { APP_FLOATING_Z_INDEX } from "@phoenix/components/core/zIndex";

import { dslFilterBadgeGrowIn } from "../styles";

/**
 * The AI-query treatment layered over the base filter field, applied to the
 * AIOutline wrapper: sizes the outline like the bare field sizes itself,
 * silences its resting stroke (the field should look untouched until AI
 * query actually engages), and styles the AI controls composed into the
 * field's control cluster.
 */
export const aiQueryFilterFieldCSS = css`
  flex: 1 1 auto;
  min-width: 0;
  /* The gradient hugs the field's border — the outline's default standoff
     gap reads as a detached double border on an input */
  --ai-outline-gap: 0px;
  &[data-state="idle"] .ai-outline__stroke {
    opacity: 0;
  }
  /* While the generative border is showing it is the focus affordance —
     focus brings the band to full strength (the field's own theme focus
     ring is suppressed below, since it would clash with the gradient) */
  &:not([data-state="idle"]):has(.cm-content:focus-visible)
    .ai-outline__stroke {
    opacity: 1;
  }
  /* The outline isolates its stacking (for the glow layers), which traps
     the typeahead's own z-index inside it — later-stacked page content
     like a table's sticky header would paint over the open dropdown.
     Elevate the whole outline only while a tooltip is showing so the
     field doesn't sit above sibling floating UI the rest of the time. */
  &:has(.cm-tooltip) {
    z-index: ${APP_FLOATING_Z_INDEX};
  }
  /* In the prose variant the gradient wraps the field and IS the border —
     the input's own border under it reads as a second, internal ring, and
     the theme focus ring on top of it reads as two clashing borders */
  .dsl-filter-condition-field[data-variant="prose"] {
    border-color: transparent;
    &:has(.cm-content:focus-visible) {
      outline: none;
    }
  }
  /* The converting glyph keeps the resting glyph's footprint (no layout
     shift) and wears the assistant's thinking tint */
  .ai-query-filter-field__thinking-glyph {
    display: grid;
    place-items: center;
    flex: none;
    width: ${glyphSize}px;
    height: ${glyphSize}px;
    color: color-mix(
      in srgb,
      var(--ai-gradient-color-middle) 78%,
      var(--ai-gradient-color-end)
    );
  }
  /* One treatment spec for the engaged AI controls — the badge and the
     pressed sparkle toggle read as one family, while the neutral buttons
     (gear, clear) stay gray */
  .ai-badge,
  .ai-mode-toggle[aria-pressed="true"] {
    color: var(--ai-gradient-color-middle);
    border-color: color-mix(
      in srgb,
      var(--ai-gradient-color-middle) 35%,
      transparent
    );
    background-color: color-mix(
      in srgb,
      var(--ai-gradient-color-middle) 12%,
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
    animation: ${dslFilterBadgeGrowIn} 0.25s ease-out;
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
        var(--ai-gradient-color-middle) 18%,
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
      var(--ai-gradient-color-middle) 20%,
      transparent
    );
  }
`;
