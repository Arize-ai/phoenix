import type { SizeValue } from "./sizing";

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
 * Default maximum size for resizable drawers. Expansion is additionally
 * capped so the side navigation stays clear by {@link DRAWER_SIDE_NAV_GAP_PX},
 * or — with no navigation to measure — so at least
 * {@link DRAWER_VISIBLE_GUTTER_PX} of the page stays visible.
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
 * Breathing room between the side navigation's right edge and a maximally
 * expanded drawer. The navigation's width is *measured live* (and observed
 * for resizes), so collapsed, expanded, and mid-animation states are all
 * handled by adding this gap to whatever the nav currently occupies.
 */
export const DRAWER_SIDE_NAV_GAP_PX = 28;

/**
 * Floor on the page area that stays visible at maximum drawer expansion,
 * for when there is no side navigation to measure — an unhosted drawer
 * rendered outside the app frame (Storybook, tests), or the first paint
 * before the nav ref registers. Drawers are non-modal, so some clickable
 * page must always remain. When a nav is present, `nav width +
 * DRAWER_SIDE_NAV_GAP_PX` meets or exceeds this floor and wins the `max()`
 * in the Drawer's gutter calculation (collapsed nav + gap happens to equal
 * exactly 80; the values drift independently on purpose).
 */
export const DRAWER_VISIBLE_GUTTER_PX = 80;
