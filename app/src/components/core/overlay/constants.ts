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
