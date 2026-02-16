import { SESSION_ID } from "../instrumentation.js";

import { intro, log, note } from "@clack/prompts";

/**
 * Display welcome message and available commands
 */
export function printWelcome() {
  intro("CLI Agent Starter Kit");

  const toolsAndCommands = `Available tools:
  • Date/Time - Get current date and time
  • Documentation - Search Phoenix and Arize-AX docs

Commands:
  /exit or /quit - Exit the agent
  /help - Show this help message
  /clear - Clear conversation history`;

  note(toolsAndCommands, "Interactive Mode");
  log.info(`Session ID: ${SESSION_ID}`);
}
