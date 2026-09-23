/**
 * The Phoenix Storybook taxonomy: three roots, and the subjects and product
 * surfaces beneath them.
 *
 * This is the single source of truth. `.storybook/preview.tsx` builds its
 * `storySort` order from it and `scripts/lint-stories.ts` enforces that every
 * title and file path agrees with it, so the sidebar cannot drift from the
 * files on disk.
 *
 * Grouping is by SUBJECT, never by abstraction tier. A tier-first split
 * (foundations / components / patterns) scatters everything a reader needs for
 * one subject across distant roots; tier is a property of an entry, not an
 * organizing axis.
 */

export const ROOTS = ["Design System", "Domains", "Storybook"] as const;
export type Root = (typeof ROOTS)[number];

/**
 * Subjects under `Design System`, in sidebar order.
 *
 * Membership test is breadth of use, not simplicity: `Tables` belongs here
 * despite being large, and a one-off card does not despite being small.
 *
 * Ordered roughly substrate-first (color, type, layout) then by interaction
 * kind, so a reader scanning the list meets the foundations before the
 * composites. No ampersands: these become directory names, and `&` is hostile
 * to globs and shell commands.
 */
export const DESIGN_SYSTEM_SUBJECTS = [
  "Color",
  "Typography",
  "Layout",
  "Icons",
  "Actions",
  "Forms",
  "Overlays",
  "Badges",
  "Feedback",
  "Errors",
  "Navigation",
  "Tables",
  "Data visualization",
  "Dates and times",
  "Code",
  "Media",
  "Drag and resize",
] as const;
export type DesignSystemSubject = (typeof DESIGN_SYSTEM_SUBJECTS)[number];

/**
 * Product surfaces under `Domains`, named as a user would name them.
 *
 * `Cost` displays token counts and prices. It must not be called `Tokens`:
 * that name belongs to design tokens.
 */
export const DOMAIN_SURFACES = [
  "Tracing",
  "Experiments",
  "Datasets",
  "Evaluators",
  "Annotations",
  "Playground",
  "Prompts",
  "PXI",
  "Cost",
  "App shell",
  "Auth",
  "Settings",
] as const;
export type DomainSurface = (typeof DOMAIN_SURFACES)[number];

/**
 * Pages under `Storybook`, in reading order: how to write a story, then the
 * vocabulary it must use, then the mechanics, then the current state.
 *
 * `Storybook` has no section layer — these are leaf pages directly under the root.
 */
export const STORYBOOK_PAGES = [
  "Writing a story",
  "Tags",
  "Storybook frames",
  "Storybook health",
] as const;

/**
 * Roots that existed before the reorganization.
 *
 * Kept in `storySort` for one layer only, so that L1 does not scramble the
 * sidebar while every story still carries its old title. L2 relocates and
 * retitles everything and deletes this list.
 *
 * @see _work/storybook-reorganization/plan.md
 */
export const LEGACY_ROOTS = [
  "Reference",
  "Core",
  "Charting",
  "Chart",
  "Charts",
  "Code",
  "DateTime",
  "Table",
  "Tokens",
  "Annotation",
  "AI",
  "Agent",
  "Trace",
  "Experiment",
  "Prompt",
  "Playground",
  "Generative",
  "Filter",
  "Project",
  "Nav",
  "User",
  "Auth",
  "Sandbox",
  "DnD",
  "Empty States",
] as const;

/**
 * NOTE: there is deliberately no `STORY_SORT_ORDER` export here.
 *
 * Storybook requires `options.storySort` to be an **inline literal** — it
 * statically parses `.storybook/preview.tsx` to read it and never evaluates
 * the module, so an imported constant fails the build with
 * `Unexpected '<identifier>'`.
 *
 * The order therefore lives inline in preview.tsx, and `pnpm lint:stories`
 * parses that literal and asserts it mentions every root, Storybook page, subject
 * and surface declared above. That is a stronger guarantee than sharing a
 * constant would give, because it also catches a hand-edit to preview.tsx that
 * drifts from this file.
 */

/** Name reserved for a subject's entry-point page, sorted first. */
export const OVERVIEW_STORY_NAME = "Overview";

/**
 * Directory slug for one title segment.
 *
 * Directories are slugged rather than verbatim so paths stay safe for globs,
 * shell commands and CI path filters. The linter only ever checks
 * `slug(title) === directory`, never the reverse, so the function does not
 * need to be invertible.
 */
export function slugSegment(segment: string): string {
  return segment
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * The directory a story with this title must live in, relative to `stories/`.
 * Built from every segment except the last, which is the entry's own name and
 * belongs to the filename.
 */
export function expectedDirForTitle(title: string): string {
  const segments = title.split("/").map((s) => s.trim());
  return segments.slice(0, -1).map(slugSegment).join("/");
}

/** The last title segment — the component or page name. */
export function leafOfTitle(title: string): string {
  const segments = title.split("/").map((s) => s.trim());
  return segments[segments.length - 1] ?? "";
}

/**
 * Comparison key for matching a title leaf against a filename. Both sides are
 * reduced to lowercase alphanumerics so that `Time Range Form` and
 * `TimeRangeForm.stories.tsx` compare equal.
 */
export function nameKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Valid second segment for a root that has a fixed set of them. */
export function allowedSecondSegments(root: string): readonly string[] | null {
  if (root === "Design System") return DESIGN_SYSTEM_SUBJECTS;
  if (root === "Domains") return DOMAIN_SURFACES;
  return null;
}
