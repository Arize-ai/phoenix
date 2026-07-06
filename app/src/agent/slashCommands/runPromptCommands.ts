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
 * Each command owns its run behavior in the catalog, so a command cannot appear
 * in the menu without execution wiring. Unknown names throw loudly rather than
 * silently dropping the submitted text.
 */
export function runPromptCommands(
  { commandNames, text, requestedSkills }: PromptCommandSubmit,
  context: PromptCommandContext
): void {
  for (const commandName of commandNames) {
    const command = commandByName.get(commandName);
    if (!command) {
      throw new Error(`Unknown prompt command: ${commandName}`);
    }
    command.run({ text, requestedSkills }, context);
  }
}
