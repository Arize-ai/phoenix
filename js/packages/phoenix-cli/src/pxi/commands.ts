/**
 * Client-side slash commands for the PXI chat UI.
 *
 * Commands are intercepted before the input reaches the server, so they run
 * instantly and never consume a network round-trip.
 */

export type CommandContext = {
  clearMessages: () => void;
  exit: () => void;
};

export type PxiCommand = {
  /** The name after the leading slash, e.g. "clear" for `/clear`. */
  name: string;
  description: string;
  handler: (args: string, ctx: CommandContext) => void;
};

export const SLASH_COMMANDS: PxiCommand[] = [
  {
    name: "clear",
    description: "Clear the conversation history",
    handler: (_args, ctx) => ctx.clearMessages(),
  },
  {
    name: "exit",
    description: "Exit PXI",
    handler: (_args, ctx) => ctx.exit(),
  },
  {
    name: "help",
    description: "Show available slash commands",
    handler: (_args, _ctx) => {
      // handled specially in the UI to print the command list
    },
  },
];

const COMMAND_MAP = new Map(SLASH_COMMANDS.map((c) => [c.name, c]));

export type SlashCommandResult =
  | { type: "unknown"; name: string }
  | { type: "handled" }
  | { type: "help" };

/**
 * Parse and dispatch a slash command string. Returns a result describing what
 * happened so the caller can react (e.g. display an error for unknown commands).
 *
 * @param input - The full draft string, expected to start with `/`.
 */
export function runSlashCommand(
  input: string,
  ctx: CommandContext
): SlashCommandResult {
  const withoutSlash = input.slice(1).trimStart();
  const spaceIndex = withoutSlash.indexOf(" ");
  const name = (
    spaceIndex === -1 ? withoutSlash : withoutSlash.slice(0, spaceIndex)
  ).toLowerCase();
  const args =
    spaceIndex === -1 ? "" : withoutSlash.slice(spaceIndex + 1).trim();

  if (name === "help") {
    return { type: "help" };
  }

  const command = COMMAND_MAP.get(name);
  if (!command) {
    return { type: "unknown", name };
  }

  command.handler(args, ctx);
  return { type: "handled" };
}

/** Return the command name being typed, or null if the input isn't a slash command. */
export function getSlashCommandName(draft: string): string | null {
  if (!draft.startsWith("/")) return null;
  const rest = draft.slice(1);
  const spaceIndex = rest.indexOf(" ");
  return spaceIndex === -1 ? rest : rest.slice(0, spaceIndex);
}

/** Return commands whose names start with the given prefix (case-insensitive). */
export function matchingCommands(prefix: string): PxiCommand[] {
  const lower = prefix.toLowerCase();
  return SLASH_COMMANDS.filter((c) => c.name.startsWith(lower));
}
