import type { SizeValue } from "@phoenix/types/sizing";

/**
 * Minimum size for fullscreen-style resizable slideovers (e.g. trace,
 * session, evaluator detail drawers). Import this constant so every
 * consumer stays in sync. Expressed as a percentage of the viewport width.
 */
export const SLIDEOVER_MIN_SIZE: SizeValue = "40%";
