import type { SizeValue } from "@phoenix/types/sizing";

/**
 * Default initial size for resizable drawers when no persisted size or
 * caller-provided `defaultSize` is available. Callers may override via
 * the `defaultSize` prop on `<Drawer>`. Expressed as a percentage of the
 * application viewport width.
 */
export const DRAWER_DEFAULT_SIZE: SizeValue = "35%";

/**
 * Default minimum size for resizable drawers (e.g. trace, session,
 * evaluator detail drawers). Callers may override via the `minSize` prop
 * on `<Drawer>`. Expressed as a percentage of the application viewport width.
 */
export const DRAWER_DEFAULT_MIN_SIZE: SizeValue = "40%";

/**
 * Default maximum size for resizable drawers. The drawer also always leaves
 * {@link DRAWER_VISIBLE_GUTTER_PX} of the application viewport visible.
 */
export const DRAWER_DEFAULT_MAX_SIZE: SizeValue = "95%";

/**
 * Absolute pixel floor — the drawer never shrinks below this regardless of
 * what its percentage-based minimum resolves to on a small viewport. This
 * is *not* overridable by callers and acts as a hard safety bound on top
 * of `minSize`.
 */
export const DRAWER_HARD_MIN_SIZE_PX = 320;

/** Space that remains visible at the left edge at maximum drawer expansion. */
export const DRAWER_VISIBLE_GUTTER_PX = 80;

/** Stable class used by app-level code to observe drawer presence. */
export const DRAWER_CLASS_NAME = "phoenix-drawer";

/** Stable class used by app-level code to observe the topmost modal. */
export const MODAL_OVERLAY_CLASS_NAME = "react-aria-ModalOverlay";

/**
 * Marks the same-modal portal container. Portals mounted here remain inside
 * the active modal's interaction scope.
 */
export const MODAL_PORTAL_CONTAINER_ATTR = "data-modal-portal-container";
export const MODAL_PORTAL_CONTAINER_SELECTOR = `[${MODAL_PORTAL_CONTAINER_ATTR}]`;
