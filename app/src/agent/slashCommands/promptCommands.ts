/**
 * Local prompt commands for the slash-command menu.
 *
 * Unlike skills — which the server advertises and force-loads into the agent —
 * commands are handled entirely in the UI. They share the slash-token grammar
 * and menu with skills, but at submit time their tokens are stripped from the
 * message and executed by the chat surface before any remaining text is sent.
 */

import { findSlashTokens } from "./slashTokens";

export type PromptCommand = {
  /** The command identifier the user types after the slash (e.g. `clear`). */
  name: string;
  /** One-line summary shown in the slash-command menu. */
  summary: string;
  /**
   * Display string for the command's keyboard shortcut (e.g. `⌘⇧K`), shown as
   * a pill in the slash-command menu when present. Purely informational — the
   * binding itself lives with whatever surface owns the shortcut.
   */
  keybind?: string;
};

/**
 * The catalog of local prompt commands, in menu order.
 *
 * Command names share a namespace with server skill names; the submit parse
 * runs commands first, so a colliding name would shadow the skill. Keep
 * command names distinct from anything the server is likely to advertise.
 */
export const PROMPT_COMMANDS: PromptCommand[] = [
  {
    name: "clear",
    summary: "Clear the conversation and start a new session",
  },
];

export type ParsedPromptCommands = {
  /** Unique recognized command names, in first-appearance order. */
  commandNames: string[];
  /** The message with recognized command tokens removed. */
  text: string;
};

/**
 * Extract recognized command tokens from `text` and strip them out.
 *
 * Unknown tokens are left untouched so a stray `/foo` stays plain text (and
 * may still be a skill request — the skill parse runs on the stripped text).
 * Stripping consumes whitespace following each removed token so the remaining
 * words keep single separators; the result is trimmed.
 */
export function parsePromptCommands(
  text: string,
  availableCommandNames: ReadonlySet<string>
): ParsedPromptCommands {
  const commandNames: string[] = [];
  const seen = new Set<string>();
  let stripped = "";
  let cursor = 0;
  for (const token of findSlashTokens(text)) {
    if (!availableCommandNames.has(token.name)) {
      continue;
    }
    if (!seen.has(token.name)) {
      seen.add(token.name);
      commandNames.push(token.name);
    }
    stripped += text.slice(cursor, token.start);
    cursor = token.end;
    // Consume the whitespace that separated the token from the next word so
    // removal doesn't leave a double space.
    while (cursor < text.length && /\s/.test(text[cursor])) {
      cursor += 1;
    }
  }
  stripped += text.slice(cursor);
  return { commandNames, text: stripped.trim() };
}
