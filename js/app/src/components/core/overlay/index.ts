/**
 * @phoenix overlay module — every surface that appears over the UI, and the
 * application frame that anchors them. See README.md in this directory for
 * the architecture (tiers, planes, stacking bands, dismissal) and the
 * ledger of react-aria polyfills this module carries.
 *
 * This file is the module's only public entry point. Nothing outside this
 * directory may deep-import a sibling file, and nothing in this directory
 * may import application code — the module depends only on react, react-dom,
 * react-aria(-components), react-stately, @emotion/react, clsx, and
 * react-hotkeys-hook, plus the CSS design tokens documented in README.md.
 */

// ── The frame: planes, blocking state, portal re-homing ──────────────────
export {
  DrawerPlane,
  OverlayFrameProvider,
  useOverlayFrame,
  VIEWPORT_MODAL_INTERACTION_EXEMPT_ATTRIBUTE,
  VIEWPORT_MODAL_INTERACTION_EXEMPT_SELECTOR,
  ViewportModalPlane,
  ViewportPortal,
  viewportModalInteractionExemptProps,
} from "./frame";

// ── Tier 1: viewport modal (blocks the workspace, not the rail) ──────────
export type {
  ViewportModalOverlayProps,
  ViewportModalProps,
} from "./ViewportModal";
export { ViewportModal, ViewportModalOverlay } from "./ViewportModal";

// ── Tier 2: window modal (blocks everything; destructive confirmations) ──
export type { ModalProps, ModalSize } from "./Modal";
export {
  centeredModalCSS,
  Modal,
  modalBackdropCSS,
  ModalOverlay,
} from "./Modal";

// ── Non-modal surfaces: popovers (and, via Popover, menus) ────────────────
export type { PopoverProps } from "./Popover";
export { Popover } from "./Popover";
export type { PopoverArrowProps } from "./PopoverArrow";
export { PopoverArrow } from "./PopoverArrow";
export { popoverSurfaceCSS } from "./styles";

// ── Non-modal surfaces: the drawer ────────────────────────────────────────
export type { DrawerProps } from "./Drawer";
export { Drawer } from "./Drawer";
export { DrawerContext } from "./DrawerContext";
export {
  DRAWER_DEFAULT_MAX_SIZE,
  DRAWER_DEFAULT_MIN_SIZE,
  DRAWER_DEFAULT_SIZE,
  DRAWER_HARD_MIN_SIZE_PX,
  DRAWER_SIDE_NAV_GAP_PX,
  DRAWER_VISIBLE_GUTTER_PX,
} from "./constants";
export type {
  UseDefaultDrawerSizeOptions,
  UseDefaultDrawerSizeResult,
} from "./useDefaultDrawerSize";
export { useDefaultDrawerSize } from "./useDefaultDrawerSize";

// ── Stacking: bands and the CSS token contract ────────────────────────────
export type { OverlayStackingBand } from "./stacking";
export {
  APP_FLOATING_Z_INDEX,
  APP_MODAL_BACKDROP_Z_INDEX,
  APP_MODAL_Z_INDEX,
  APP_PORTALED_OVERLAY_Z_INDEX,
  OVERLAY_STACKING_BAND_Z_INDEX,
  OVERLAY_STACKING_BANDS,
} from "./stacking";

// ── Shared vocabulary ─────────────────────────────────────────────────────
export type { SizeValue } from "./sizing";
