import {
  getInputAttributes,
  getOutputAttributes,
  withSpan,
} from "@arizeai/openinference-core";
import {
  cancel,
  isCancel,
  log,
  note,
  outro,
  spinner,
  text,
} from "@clack/prompts";

import { Agent } from "../agents/index.js";
import { SESSION_ID } from "../instrumentation.js";
import { printWelcome } from "./welcome.js";

/**
 * Convert literal ANSI escape sequences to actual escape codes
 * Transforms text like "\\x1b[1m" into actual ANSI codes that terminals interpret
 */
function unescapeAnsi(text: string): string {
  return text.replace(/\\x1b/g, "\x1b");
}

/**
 * Display exit message
 *
 * @param cancelled - Whether the exit was triggered by user cancellation (Ctrl+C)
 */
function displayExitMessage(cancelled = false) {
  if (cancelled) {
    cancel("Operation cancelled");
  } else {
    outro("Thanks for using CLI Agent Starter Kit!");
  }
}

/**
 * Run a single interaction through the agent with the standard cli.interaction span.
 * Use this in scripts (seed, eval) to ensure the same span topology as the live CLI.
 */
export async function runInteraction({
  input,
  agent,
}: {
  input: string;
  agent: Agent;
}) {
  const handleInteraction = withSpan(
    async (input: string) => agent.generate({ prompt: input }),
    {
      name: "cli.interaction",
      kind: "CHAIN",
      attributes: { "session.id": SESSION_ID },
      processInput: (input: string) => getInputAttributes(input),
      processOutput: (result) => getOutputAttributes(result.text),
    }
  );
  return handleInteraction(input);
}

/**
 * Process a user message through the agent and display the response
 */
export async function processUserMessage({
  input,
  agent,
}: {
  input: string;
  agent: Agent;
}) {
  const s = spinner();
  s.start("Agent is thinking...");

  try {
    const verbose = process.env.VERBOSE === "true";
    let stepNumber = 0;

    const handleInteraction = withSpan(
      async (input: string) => {
        return await agent.generate({
          options: undefined,
          prompt: input,
          onStepFinish: async ({ usage: _usage, finishReason, toolCalls }) => {
            if (verbose) {
              stepNumber++;
              const tools = toolCalls
                ? toolCalls.map((tc) => tc.toolName).join(", ")
                : "no tools";
              s.message(`Step ${stepNumber}: ${finishReason} - ${tools}`);
            } else if (toolCalls && toolCalls.length > 0) {
              const toolNames = toolCalls.map((tc) => tc.toolName).join(", ");
              s.message(`Using tools: ${toolNames}`);
            }
          },
        });
      },
      {
        name: "cli.interaction",
        kind: "CHAIN",
        attributes: { "session.id": SESSION_ID },
        // Capture input - automatically sets input.value and input.mime_type
        processInput: (input: string) => getInputAttributes(input),
        // Capture output - automatically sets output.value and output.mime_type
        processOutput: (result) => getOutputAttributes(result.text),
      }
    );

    const result = await handleInteraction(input);

    s.stop("Agent");

    // Display response with ANSI color support
    // Convert literal escape sequences (e.g., "\x1b[1m") to actual ANSI codes
    // Use note() for consistent clack formatting with the gray sidebar
    note(unescapeAnsi(result.text), "Agent");

    if (verbose) {
      log.info(`Completed in ${result.steps.length} steps`);
    }
  } catch (error) {
    s.stop("Agent encountered an error");
    log.error(String(error));
  }
}

/**
 * Main conversation loop - handles user input and commands
 */
export async function conversationLoop({
  agent,
}: {
  agent: Agent;
}): Promise<void> {
  while (true) {
    const userInput = await text({
      message: "You",
      placeholder: "Ask a question or use /help for commands",
    });

    if (isCancel(userInput)) {
      displayExitMessage(true);
      return;
    }

    const input = (userInput as string).trim();

    // Command handling
    if (input === "/exit" || input === "/quit") {
      displayExitMessage();
      return;
    }

    if (input === "/help") {
      printWelcome();
      continue;
    }

    if (!input) {
      continue;
    }

    // Process message with spinner
    await processUserMessage({ input, agent });
  }
}
