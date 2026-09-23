/**
 * Storybook tag vocabulary for the Phoenix story set.
 *
 * Three independent axes, plus one flag (`unused`). Every story declares exactly one value from each
 * required axis; both sides are tagged explicitly so that "nobody set this"
 * and "this is the negative case" never look alike.
 *
 * Because each value is a single tag, Storybook's built-in "Tag filters" menu
 * covers every single-axis question with no custom filter code.
 *
 * IMPORTANT: a story must write its tags as plain string literals —
 * `tags: ["legacy", "unreviewed"]`. Storybook statically parses CSF and its
 * `parseTags` requires every array element to be a string literal, so
 * referencing the constants below (`tags: [provenance.legacy]`) fails indexing
 * with `CSF: Expected tag to be string literal`. A `satisfies` clause fails
 * too, because the parser then no longer sees an array expression.
 *
 * So this module is not imported by stories. It is the vocabulary for the
 * linter and the sidebar chips, and `pnpm lint:stories` is what catches a
 * misspelled tag — which also checks axis cardinality, something types could
 * not do anyway.
 *
 * @see app/.storybook/manager.ts for the sidebar chips these drive
 * @see app/scripts/lint-stories.ts for the rules that enforce them
 */

/** Did this story exist before the Storybook reorganization? */
export const provenance = {
  /**
   * Predates the reorganization. Still `legacy` after being moved or
   * renamed — relocating a file does not make its content updated.
   */
  legacy: "legacy",
  /** Authored or rewritten as part of the reorganization. */
  updated: "updated",
} as const;

/**
 * Do the stories cover every state the component exposes?
 *
 * A claim about parity with the component, not about polish. Required on
 * `updated` stories and optional on `legacy` ones: `incomplete` asserts that
 * someone compared the stories against the component, and a mechanical
 * relocation has no basis for that claim in either direction.
 */
export const completeness = {
  complete: "complete",
  incomplete: "incomplete",
} as const;

/**
 * Has a human verified this story is correct?
 *
 * `reviewed` means Rick checked it. Nothing else sets it — not an agent, not
 * a passing lint run, not a careful self-review.
 */
export const review = {
  reviewed: "reviewed",
  unreviewed: "unreviewed",
} as const;

/**
 * Does production render this entry's component anywhere?
 *
 * A flag, not an axis: `unused` is present when no production code calls the
 * component, and absent otherwise. It is the one exception to tagging both
 * sides, because "used" is the normal case for every component and a
 * `used` chip on nearly every entry would be noise. The absence is still
 * never ambiguous: `pnpm lint:stories` derives callers from `src/` for every
 * file whose `meta.component` it can resolve, and fails when the tag and the
 * code disagree in either direction.
 */
export const usage = {
  unused: "unused",
} as const;

export type ProvenanceTag = (typeof provenance)[keyof typeof provenance];
export type CompletenessTag = (typeof completeness)[keyof typeof completeness];
export type ReviewTag = (typeof review)[keyof typeof review];
export type UsageTag = (typeof usage)[keyof typeof usage];
export type PhoenixStoryTag =
  | ProvenanceTag
  | CompletenessTag
  | ReviewTag
  | UsageTag;

/** The three axes, as data, for the linter and the sidebar chips. */
export const TAG_AXES = [
  { name: "provenance", values: provenance, required: "always" },
  { name: "completeness", values: completeness, required: "whenUpdated" },
  { name: "review", values: review, required: "always" },
] as const;

export const ALL_PHOENIX_TAGS: readonly PhoenixStoryTag[] = [
  ...Object.values(provenance),
  ...Object.values(completeness),
  ...Object.values(review),
  ...Object.values(usage),
];

/**
 * Tags Storybook itself defines. A Phoenix tag must never collide with one,
 * and a story may legitimately carry these alongside its axis tags.
 *
 * @see https://storybook.js.org/docs/writing-stories/tags
 */
export const STORYBOOK_BUILTIN_TAGS: readonly string[] = [
  "dev",
  "docs",
  "autodocs",
  "test",
  "manifest",
  "attached-mdx",
  "unattached-mdx",
  // Negated forms opt a story out of a globally applied tag.
  "!dev",
  "!docs",
  "!autodocs",
  "!test",
];
