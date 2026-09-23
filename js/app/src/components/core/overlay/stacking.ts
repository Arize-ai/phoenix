/**
 * Stacking — the paint-order half of the overlay contract.
 *
 * Every value here is a CSS variable alias for a token the host application
 * must define (Phoenix defines them in `GlobalStyles`). Constant names mirror
 * the `--global-z-index-app-*` token names exactly so the constant, the
 * token, and any prop value naming a band share one vocabulary — a grep for
 * any of them finds the others.
 *
 * Stacking is orthogonal to modality: never derive a band from whether a
 * surface is modal or non-modal. See README.md ("Stacking bands").
 */
import { createContext } from "react";

export const APP_FLOATING_Z_INDEX = "var(--global-z-index-app-floating)";
export const APP_MODAL_BACKDROP_Z_INDEX =
  "var(--global-z-index-app-modal-backdrop)";
export const APP_MODAL_Z_INDEX = "var(--global-z-index-app-modal)";
export const APP_PORTALED_OVERLAY_Z_INDEX =
  "var(--global-z-index-app-portaled-overlay)";

/**
 * Bands for content stacked *within* a frame plane (the planes are siblings
 * inside the application viewport's stacking context, so app-level bands do
 * not apply to them).
 */
export const LOCAL_RAISED_Z_INDEX = "var(--global-z-index-local-raised)";
export const LOCAL_OVERLAY_Z_INDEX = "var(--global-z-index-local-overlay)";

/**
 * Stacking bands an overlay surface may request, ordered lowest to highest.
 *
 * Only the bands a `Popover` may legitimately occupy are requestable:
 * `app-floating` for persistent, panel-like surfaces that modals should
 * cover, and `app-portaled-overlay` for transient light-dismiss surfaces
 * (menus, selects, pickers) that must win against whatever launched them.
 * The other rungs of the app ladder (drawer, modal, notification) belong to
 * dedicated components that pin their own band — letting a popover request
 * them would let a call site place a transient surface above a toast.
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

/**
 * Publishes an overlay's resolved band to its React descendants so a nested
 * overlay can clamp itself to at least its parent's band. Context (not DOM)
 * carries the value because nested overlays portal out of their parent's DOM.
 */
export const OverlayStackingContext = createContext<OverlayStackingBand | null>(
  null
);

/**
 * Clamp a requested band to at least the inherited (parent) band, so a child
 * overlay can never paint beneath the overlay that spawned it.
 */
export function resolveStackingBand({
  requested,
  inherited,
}: {
  requested: OverlayStackingBand;
  inherited: OverlayStackingBand | null;
}): OverlayStackingBand {
  if (
    inherited !== null &&
    OVERLAY_STACKING_BANDS.indexOf(inherited) >
      OVERLAY_STACKING_BANDS.indexOf(requested)
  ) {
    return inherited;
  }
  return requested;
}
