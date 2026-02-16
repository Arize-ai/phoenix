 
import {
  getInputAttributes,
  getOutputAttributes,
  withSpan,
} from "@arizeai/openinference-core";

import type { ConversationHistory } from "../agent/index.js";
import { SESSION_ID } from "../instrumentation.js";

import { printWelcome } from "./welcome.js";

import {
  cancel,
  isCancel,
  log,
  note,
  outro,
  spinner,
  text,
} from "@clack/prompts";
import { ToolLoopAgent } from "ai";

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
 * Process a user message through the agent and display the response
 *
 * @param input - The user's input message
 * @param agent - The ToolLoopAgent instance
 * @param conversationHistory - The conversation history array
 */
export async function processUserMessage(
  input: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  agent: ToolLoopAgent<any, any>,
  conversationHistory: ConversationHistory
) {
  conversationHistory.push({ role: "user", content: input });

  const s = spinner();
  s.start("Agent is thinking...");

  try {
    const verbose = process.env.VERBOSE === "true";
    let stepNumber = 0;

    const handleInteraction = withSpan(
      async (_input: string) => {
        return await agent.generate({
          options: {},
          prompt: conversationHistory
            .map(
              (msg) =>
                `${msg.role === "user" ? "User" : "Assistant"}: ${msg.content}`
            )
            .join("\n\n"),
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

    // Display response
    if (result.text.includes("\n")) {
      note(result.text, "Agent");
    } else {
      log.message(result.text);
    }

    if (verbose) {
      log.info(`Completed in ${result.steps.length} steps`);
    }

    conversationHistory.push({ role: "assistant", content: result.text });
  } catch (error) {
    s.stop("Agent encountered an error");
    log.error(String(error));
  }
}

/**
 * Main conversation loop - handles user input and commands
 *
 * @param agent - The ToolLoopAgent instance
 * @param conversationHistory - The conversation history array
 * @returns Promise that resolves when the conversation ends
 */
export async function conversationLoop(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  agent: ToolLoopAgent<any, any>,
  conversationHistory: ConversationHistory
): Promise<void> {
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

    if (input === "/clear") {
      conversationHistory.length = 0;
      log.success("Conversation history cleared");
      continue;
    }

    if (!input) {
      continue;
    }

    // Process message with spinner
    await processUserMessage(input, agent, conversationHistory);
  }
}
