import { SESSION_ID } from "../instrumentation.js";

import { intro, log, note } from "@clack/prompts";

/**
 * Display welcome message and available commands
 */
export function printWelcome() {
  intro("Phoenix Documentation Assistant");

  const toolsAndCommands = `Ask me anything about Phoenix!

Available capabilities:
  • Phoenix documentation search
  • Code examples and usage patterns
  • API reference and guides
  • Best practices and troubleshooting

Commands:
  /exit or /quit - Exit the agent
  /help - Show this help message`;

  note(toolsAndCommands, "Interactive Mode");
  log.info(`Session ID: ${SESSION_ID}`);
}
