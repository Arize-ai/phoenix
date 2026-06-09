/**
 * Execution for local prompt commands (see {@link PROMPT_COMMANDS} in
 * promptCommands.ts for the catalog).
 *
 * Commands run before any remaining message text is sent. This module is
 * deliberately framework-free: the chat surface injects the session operations
 * it owns, so command behavior can be tested without React or the store.
 */

import type { PendingAgentMessage } from "@phoenix/store/agentStore";

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
  /** Create and activate a fresh session, returning its id. */
  createSession: () => string;
  /**
   * Stage a message to be auto-sent when the given session's chat view
   * mounts.
   */
  setPendingMessage: (sessionId: string, message: PendingAgentMessage) => void;
};

/**
 * Execute the local prompt commands parsed from a submitted message.
 *
 * `/clear` swaps to a fresh session; the rest of the message (if any) is
 * staged to auto-send once the new session's view mounts. Unrecognized names
 * are ignored — the submit parse only forwards cataloged commands, so this is
 * purely defensive.
 */
export function runPromptCommands(
  { commandNames, text, requestedSkills }: PromptCommandSubmit,
  context: PromptCommandContext
): void {
  if (commandNames.includes("clear")) {
    const newSessionId = context.createSession();
    if (text) {
      context.setPendingMessage(newSessionId, { text, requestedSkills });
    }
  }
}
