import { css } from "@emotion/react";

/**
 * Shared drag feedback for dnd-kit sortables, keyed off the `data-dnd-dragging`
 * (flying copy) and `data-dnd-placeholder` (drop slot) attributes dnd-kit sets.
 * Compose into a sortable's CSS and layer element-specific backgrounds on top.
 *
 * The lifted copy keeps its resting shape and only gains a shadow so the FLIP
 * drop reads as a settle, not a shape change; the drop slot is a quiet tint.
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
