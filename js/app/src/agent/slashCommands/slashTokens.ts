/**
 * Tokenizing for the prompt input's slash-command affordances.
 *
 * A slash token is the shared grammar behind both skill requests
 * (`/debug-trace`) and local prompt commands (`/clear`): a `/` at the start of
 * the string or after whitespace followed by a slug-shaped name. These helpers
 * only recognize tokens; callers decide what a token means by validating the
 * name against their own catalog.
 */

/**
 * Matches a slash-command token: a `/` that begins the string or follows
 * whitespace, then a slug-shaped run (letters, digits, hyphens). Skill and
 * command names are slugs (e.g. `debug-trace`, `clear`), so this is
 * intentionally conservative.
 *
 * The leading group captures the boundary so we can re-anchor matches without a
 * lookbehind (not universally supported in the target browsers).
 */
const SLASH_TOKEN_PATTERN = /(^|\s)\/([a-zA-Z0-9-]+)/g;

export type SlashTokenMatch = {
  /** The matched token name without the leading slash. */
  name: string;
  /** Start index of the `/` in the source string. */
  start: number;
  /** End index (exclusive) of the token in the source string. */
  end: number;
};

/**
 * Find every slash-command token in `text`, in order of appearance.
 *
 * Returns the raw token names; callers validate them against their catalog
 * (skills or commands). Indices point at the `/` and one past the token so a
 * highlight overlay can slice the string precisely.
 */
export function findSlashTokens(text: string): SlashTokenMatch[] {
  const matches: SlashTokenMatch[] = [];
  for (const match of text.matchAll(SLASH_TOKEN_PATTERN)) {
    const boundary = match[1] ?? "";
    const name = match[2] ?? "";
    const tokenStart = (match.index ?? 0) + boundary.length;
    matches.push({
      name,
      start: tokenStart,
      end: tokenStart + name.length + 1, // +1 for the leading slash
    });
  }
  return matches;
}
