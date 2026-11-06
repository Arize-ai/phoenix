/**
 * Execution for local prompt commands (see {@link PROMPT_COMMANDS} in
 * promptCommands.ts for the catalog).
 *
 * Commands run before any remaining message text is sent. This module is
 * deliberately framework-free: the chat surface injects the session operations
 * it owns, so command behavior can be tested without React or the store.
 */

import {
  PROMPT_COMMANDS,
  type PromptCommandContext,
  type PromptCommandSubmit,
} from "./promptCommands";

const commandByName = new Map(
  PROMPT_COMMANDS.map((command) => [command.name, command])
);

/**
 * Execute the local prompt commands parsed from a submitted message.
 *
 * The first command owns the submit; later command tokens are stripped but not
 * also executed, preventing one prompt from triggering conflicting session
 * operations. Unknown names throw rather than silently dropping submitted text.
 */
export function runPromptCommands(
  { commandNames, text, requestedSkills }: PromptCommandSubmit,
  context: PromptCommandContext
): void {
  const commandName = commandNames[0];
  if (!commandName) {
    return;
  }
  const command = commandByName.get(commandName);
  if (!command) {
    throw new Error(`Unknown prompt command: ${commandName}`);
  }
  command.run({ text, requestedSkills }, context);
}
