/**
 * Parsing for the prompt input's slash-command skill affordance.
 *
 * Users invoke a skill by typing `/skill-name` in the message. This helper
 * recognizes those tokens so the send path can forward the requested skill
 * names to the server. The literal tokens are never stripped from the message
 * text — they remain part of what the user sent.
 */

import { findSlashTokens } from "@phoenix/agent/slashCommands/slashTokens";

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
  for (const token of findSlashTokens(text)) {
    if (!availableSkillNames.has(token.name) || seen.has(token.name)) {
      continue;
    }
    seen.add(token.name);
    requested.push(token.name);
  }
  return requested;
}
