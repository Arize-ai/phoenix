/**
 * CSS variable aliases for the canonical app stacking tokens in GlobalStyles.
 * Constant names mirror the `--global-z-index-app-*` token names exactly so
 * the constant, the token, and any prop value naming a band share one
 * vocabulary. Stacking is orthogonal to modality: never derive a band from
 * whether a surface is modal or non-modal.
 *
 * The overlay-owned rungs (floating, portaled-overlay, modal, backdrop) are
 * defined in `@phoenix/components/core/overlay` and re-exported here; this
 * file adds the rungs only the application uses.
 */
export {
  APP_FLOATING_Z_INDEX,
  APP_MODAL_BACKDROP_Z_INDEX,
  APP_MODAL_Z_INDEX,
  APP_PORTALED_OVERLAY_Z_INDEX,
} from "@phoenix/components/core/overlay";

export const APP_FLOATING_CONTROL_Z_INDEX =
  "var(--global-z-index-app-floating-control)";
export const APP_MODAL_FLOATING_Z_INDEX =
  "var(--global-z-index-app-modal-floating)";
export const APP_MODAL_FLOATING_CONTROL_Z_INDEX =
  "var(--global-z-index-app-modal-floating-control)";
export const APP_NOTIFICATION_Z_INDEX =
  "var(--global-z-index-app-notification)";
