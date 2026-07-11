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
