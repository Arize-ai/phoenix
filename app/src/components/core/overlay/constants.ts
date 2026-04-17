import type { SizeValue } from "@phoenix/types/sizing";

/**
 * Default initial size for resizable drawers when no persisted size or
 * caller-provided `defaultSize` is available. Expressed as a percentage of
 * the viewport width.
 */
export const DRAWER_DEFAULT_SIZE: SizeValue = "35%";

/**
 * Minimum size for resizable drawers (e.g. trace, session, evaluator
 * detail drawers). Import this constant so every consumer stays in sync.
 * Expressed as a percentage of the viewport width.
 */
export const DRAWER_MIN_SIZE: SizeValue = "40%";

/**
 * Maximum size for resizable drawers. Always leaves 5% of the viewport
 * visible so users can interact with content behind the drawer.
 */
export const DRAWER_MAX_SIZE: SizeValue = "95%";

/**
 * Absolute pixel floor — the drawer never shrinks below this regardless of
 * what its percentage-based minimum resolves to on a small viewport.
 */
export const DRAWER_HARD_MIN_SIZE_PX = 320;
