import { css } from "@emotion/react";

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
 * handle's own layout CSS (size, position).
 */
export const dndHandleAppearanceCSS = css`
  border: none;
  background: none;
  padding: 0;
  color: var(--global-dnd-handle-color);
  opacity: 0;
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
    outline: 1px solid var(--global-color-primary);
    outline-offset: -1px;
  }
`;
