import { css } from "@emotion/react";

/**
 * Shared drag feedback styling for dnd-kit sortables, keyed off the
 * `data-dnd-dragging` / `data-dnd-placeholder` attributes dnd-kit sets on the
 * flying copy and the drop slot. Compose into a sortable's CSS and layer
 * element-specific backgrounds on top.
 *
 * The feedback is intentionally quiet: the lifted copy keeps the element's
 * resting shape and only gains a soft shadow, so on drop it settles back down
 * instead of morphing. The drop slot is a gentle neutral wash — no dashed
 * borders or hard outlines.
 */
export const dndDragFeedbackCSS = css`
  /* The flying copy of the element while it follows the pointer. Keep the
     border-radius and borders identical to the resting state so the FLIP
     drop animation reads as a settle, not a shape change. */
  &[data-dnd-dragging] {
    box-shadow: var(--global-dnd-drag-shadow);
    cursor: grabbing;
  }
  /* The slot the element will land in — the drop invitation. dnd-kit hides
     this placeholder by default; surface it as a quiet tinted slot with no
     border so it invites rather than alerts. */
  &[data-dnd-placeholder] {
    visibility: visible !important;
    background-color: var(--global-dnd-drop-target-background-color);
    * {
      visibility: hidden;
    }
  }
`;
