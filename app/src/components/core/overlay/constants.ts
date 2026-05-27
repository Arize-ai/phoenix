import type { SizeValue } from "@phoenix/types/sizing";

/**
 * Default initial size for resizable drawers when no persisted size or
 * caller-provided `defaultSize` is available. Callers may override via
 * the `defaultSize` prop on `<Drawer>`. Expressed as a percentage of the
 * viewport width.
 */
export const DRAWER_DEFAULT_SIZE: SizeValue = "35%";

/**
 * Default minimum size for resizable drawers (e.g. trace, session,
 * evaluator detail drawers). Callers may override via the `minSize` prop
 * on `<Drawer>`. Expressed as a percentage of the viewport width.
 */
export const DRAWER_DEFAULT_MIN_SIZE: SizeValue = "40%";

/**
 * Default maximum size for resizable drawers — leaves 5% of the viewport
 * visible so users can interact with content behind the drawer. Callers
 * may override via the `maxSize` prop on `<Drawer>`.
 */
export const DRAWER_DEFAULT_MAX_SIZE: SizeValue = "95%";

/**
 * Absolute pixel floor — the drawer never shrinks below this regardless of
 * what its percentage-based minimum resolves to on a small viewport. This
 * is *not* overridable by callers and acts as a hard safety bound on top
 * of `minSize`.
 */
export const DRAWER_HARD_MIN_SIZE_PX = 320;

/**
 * Stable class added to every Phoenix drawer so app-level code can observe
 * drawer presence without depending on individual route state.
 */
export const DRAWER_CLASS_NAME = "phoenix-drawer";

/**
 * Stable class added to every Phoenix modal overlay so app-level code can
 * observe the topmost modal without depending on React Aria internals.
 */
export const MODAL_OVERLAY_CLASS_NAME = "react-aria-ModalOverlay";

/**
 * Marks the element inside a modal overlay that same-modal portals should use
 * as their container. Portaling into this element keeps those portals inside
 * React Aria's modal scope instead of making them overlay-dismiss targets.
 */
export const MODAL_PORTAL_CONTAINER_ATTR = "data-modal-portal-container";
export const MODAL_PORTAL_CONTAINER_SELECTOR = `[${MODAL_PORTAL_CONTAINER_ATTR}]`;
