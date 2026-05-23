/**
 * Shared app stacking layers.
 *
 * Non-modal floating UI should sit above page content but below modal
 * backdrops. Portaled popovers and toasts use the top overlay layer so controls
 * opened from floating surfaces remain usable.
 */
export const MODAL_OVERLAY_Z_INDEX = 1000;
export const MODAL_DIALOG_Z_INDEX = MODAL_OVERLAY_Z_INDEX + 1;
export const NON_MODAL_FLOATING_Z_INDEX = MODAL_OVERLAY_Z_INDEX - 1;
export const PORTALED_OVERLAY_Z_INDEX = 100000;
