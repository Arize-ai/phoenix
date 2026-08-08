/**
 * CSS variable aliases for the canonical app stacking tokens in GlobalStyles.
 * Constant names mirror the `--global-z-index-app-*` token names exactly so
 * the constant, the token, and any prop value naming a band share one
 * vocabulary. Stacking is orthogonal to modality: never derive a band from
 * whether a surface is modal or non-modal.
 */
export const APP_FLOATING_Z_INDEX = "var(--global-z-index-app-floating)";
export const APP_FLOATING_CONTROL_Z_INDEX =
  "var(--global-z-index-app-floating-control)";
export const APP_MODAL_BACKDROP_Z_INDEX =
  "var(--global-z-index-app-modal-backdrop)";
export const APP_MODAL_Z_INDEX = "var(--global-z-index-app-modal)";
export const APP_MODAL_FLOATING_Z_INDEX =
  "var(--global-z-index-app-modal-floating)";
export const APP_MODAL_FLOATING_CONTROL_Z_INDEX =
  "var(--global-z-index-app-modal-floating-control)";
export const APP_PORTALED_OVERLAY_Z_INDEX =
  "var(--global-z-index-app-portaled-overlay)";
export const APP_NOTIFICATION_Z_INDEX =
  "var(--global-z-index-app-notification)";

/**
 * Stacking bands an overlay surface may occupy, ordered lowest to highest.
 * A nested overlay is clamped to at least its parent's band so a child can
 * never paint beneath the overlay that spawned it.
 */
export const OVERLAY_STACKING_BANDS = [
  "app-floating",
  "app-portaled-overlay",
] as const;

export type OverlayStackingBand = (typeof OVERLAY_STACKING_BANDS)[number];

export const OVERLAY_STACKING_BAND_Z_INDEX = {
  "app-floating": APP_FLOATING_Z_INDEX,
  "app-portaled-overlay": APP_PORTALED_OVERLAY_Z_INDEX,
} as const satisfies Record<OverlayStackingBand, string>;
