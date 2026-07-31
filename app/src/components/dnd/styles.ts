import { css } from "@emotion/react";

import { revealOnHoverCSS } from "@phoenix/components/core/styles";

/**
 * Shared drag feedback for dnd-kit sortables: shadow on the dragged copy,
 * tint on the drop slot. Compose into a sortable's CSS.
 */
export const dndDragFeedbackCSS = css`
  &[data-dnd-dragging] {
    box-shadow: var(--global-dnd-drag-shadow);
    cursor: grabbing;
  }
  &[data-dnd-placeholder] {
    visibility: visible !important;
    background-color: var(--global-dnd-drop-target-background-color);
    * {
      visibility: hidden;
    }
  }
`;

/**
 * Appearance for a hover-revealed drag handle button: hidden until the
 * containing row/header is hovered (via a sibling `&:hover .{className}`
 * rule each consumer adds) or the handle itself is focused. Compose into a
 * handle's own layout CSS (size, position); for a plain list row prefer
 * {@link dndRowHandleCSS}, which already applies this.
 */
export const dndHandleAppearanceCSS = css`
  ${revealOnHoverCSS}
  border: none;
  background: none;
  padding: 0;
  color: var(--global-dnd-handle-color);
  cursor: grab;
  touch-action: none;
  border-radius: var(--global-rounding-small);
  transition:
    opacity 0.12s ease-in-out,
    color 0.12s ease-in-out,
    background-color 0.12s ease-in-out;
  &:hover {
    color: var(--global-dnd-handle-color-hover);
    background-color: var(--global-dnd-handle-background-color-hover);
  }
  &:focus-visible {
    opacity: 1;
    outline: var(--focus-ring-thickness) solid var(--focus-ring-color);
    outline-offset: calc(-1 * var(--focus-ring-thickness));
  }
`;

/**
 * A hover-revealed drag handle sized to sit at the end of a list row:
 * {@link dndHandleAppearanceCSS} in a centered square box. Compose into the
 * handle's own rule, and pair with a `&:hover .{className} { opacity: 1 }`
 * rule on the row so hovering the row reveals it.
 */
export const dndRowHandleCSS = css`
  ${dndHandleAppearanceCSS}
  display: flex;
  align-items: center;
  justify-content: center;
  flex: none;
  width: var(--global-dimension-size-225);
  height: var(--global-dimension-size-225);
  font-size: var(--global-font-size-m);
`;
