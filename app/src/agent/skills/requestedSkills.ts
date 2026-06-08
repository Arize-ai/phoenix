/**
 * Parsing for the prompt input's slash-command skill affordance.
 *
 * Users invoke a skill by typing `/skill-name` in the message. These helpers
 * recognize those tokens so the input can highlight them and the send path can
 * forward the requested skill names to the server. The literal tokens are never
 * stripped from the message text — they remain part of what the user sent.
 */

/**
 * Matches a slash-command skill token: a `/` that begins the string or follows
 * whitespace, then a skill-name-shaped run (letters, digits, hyphens). Skill
 * names are slugs (e.g. `debug-trace`), so this is intentionally conservative.
 *
 * The leading group captures the boundary so we can re-anchor matches without a
 * lookbehind (not universally supported in the target browsers).
 */
const SKILL_TOKEN_PATTERN = /(^|\s)\/([a-zA-Z0-9-]+)/g;

export type SkillTokenMatch = {
  /** The matched skill name without the leading slash. */
  name: string;
  /** Start index of the `/` in the source string. */
  start: number;
  /** End index (exclusive) of the token in the source string. */
  end: number;
};

/**
 * Find every slash-command token in `text`, in order of appearance.
 *
 * Returns the raw token names; callers validate them against the available
 * skill catalog. Indices point at the `/` and one past the token so a highlight
 * overlay can slice the string precisely.
 */
export function findSkillTokens(text: string): SkillTokenMatch[] {
  const matches: SkillTokenMatch[] = [];
  for (const match of text.matchAll(SKILL_TOKEN_PATTERN)) {
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

/**
 * Return the unique skill names in `text` that exist in `availableSkillNames`,
 * preserving first-appearance order.
 *
 * This is the source of truth for both the highlight (which tokens are real)
 * and the `requestedSkills` payload (what the server force-loads). Unknown
 * tokens are ignored so a stray `/foo` is treated as plain text.
 */
export function parseRequestedSkills(
  text: string,
  availableSkillNames: ReadonlySet<string>
): string[] {
  const requested: string[] = [];
  const seen = new Set<string>();
  for (const token of findSkillTokens(text)) {
    if (!availableSkillNames.has(token.name) || seen.has(token.name)) {
      continue;
    }
    seen.add(token.name);
    requested.push(token.name);
  }
  return requested;
}
