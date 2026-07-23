/**
 * Local prompt commands for the slash-command menu.
 *
 * Unlike skills — which the server advertises and force-loads into the agent —
 * commands are handled entirely in the UI. They share the slash-token grammar
 * and menu with skills, but at submit time their tokens are stripped from the
 * message and executed by the chat surface before any remaining text is sent.
 */

import type { PendingAgentMessage } from "@phoenix/store/agentStore";

import type { SlashTokenMatch } from "./slashTokens";

const PROMPT_COMMAND_PATTERN = /\/([a-zA-Z0-9-]+)(?=$|\s)/y;

/**
 * The message left over after command tokens were stripped from a submit,
 * along with the skills it requests. Commands decide what happens to it —
 * `/clear` forwards it into the fresh session.
 */
export type PromptCommandSubmit = {
  /** Recognized command names from the submit, in first-appearance order. */
  commandNames: string[];
  /** The submitted message with command tokens stripped; may be empty. */
  text: string;
  /** Skill names recognized in `text`. */
  requestedSkills: string[];
};

/**
 * Session operations a chat surface must provide for commands to act on.
 */
export type PromptCommandContext = {
  /** Compact older turns, then optionally submit the remaining prompt text. */
  compactSession: (message?: PendingAgentMessage) => void;
  /**
   * Switch to a fresh draft chat surface, returning the key under which a
   * pending message can be staged. The server session itself is created when
   * the staged (or first typed) message is sent.
   */
  startNewSession: () => string;
  /**
   * Stage a message to be auto-sent when the given session's chat view
   * mounts.
   */
  setPendingMessage: (sessionId: string, message: PendingAgentMessage) => void;
};

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
  /** Execute the command against the owning chat surface. */
  run: (
    submit: Omit<PromptCommandSubmit, "commandNames">,
    context: PromptCommandContext
  ) => void;
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
    name: "compact",
    summary: "Compact older conversation context",
    run: ({ text, requestedSkills }, context) => {
      context.compactSession(text ? { text, requestedSkills } : undefined);
    },
  },
  {
    name: "clear",
    summary: "Clear the conversation and start a new session",
    run: ({ text, requestedSkills }, context) => {
      const stagingKey = context.startNewSession();
      if (text) {
        context.setPendingMessage(stagingKey, { text, requestedSkills });
      }
    },
  },
];

export type ParsedPromptCommands = {
  /** Unique recognized command names, in first-appearance order. */
  commandNames: string[];
  /** The message with recognized command tokens removed. */
  text: string;
};

/**
 * Find executable local prompt commands at the start of `text`.
 *
 * Commands are intentionally stricter than skill tokens because they have local
 * side effects: they must start the prompt, and the command name must be
 * followed by whitespace or the end of the prompt. That keeps prose such as
 * "what does /clear do?" and punctuation such as `/clear.` inert.
 */
export function findPromptCommandTokens(
  text: string,
  availableCommandNames: ReadonlySet<string>
): SlashTokenMatch[] {
  const tokens: SlashTokenMatch[] = [];
  let cursor = 0;
  while (cursor < text.length) {
    PROMPT_COMMAND_PATTERN.lastIndex = cursor;
    const match = PROMPT_COMMAND_PATTERN.exec(text);
    if (!match || match.index !== cursor) {
      break;
    }
    const name = match[1] ?? "";
    if (!availableCommandNames.has(name)) {
      break;
    }
    tokens.push({
      name,
      start: cursor,
      end: cursor + name.length + 1, // +1 for the leading slash
    });
    cursor = PROMPT_COMMAND_PATTERN.lastIndex;
    while (cursor < text.length && /\s/.test(text[cursor])) {
      cursor += 1;
    }
  }
  return tokens;
}

/**
 * Extract recognized executable command tokens from `text` and strip them out.
 *
 * Command tokens only execute from the start of the prompt. Unknown tokens and
 * mid-message mentions stay plain text (and may still be skill requests — the
 * skill parse runs on the stripped text). Stripping consumes whitespace
 * following each removed token so the remaining words keep single separators;
 * the result is trimmed.
 */
export function parsePromptCommands(
  text: string,
  availableCommandNames: ReadonlySet<string>
): ParsedPromptCommands {
  const commandNames: string[] = [];
  const seen = new Set<string>();
  let stripped = "";
  let cursor = 0;
  for (const token of findPromptCommandTokens(text, availableCommandNames)) {
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
