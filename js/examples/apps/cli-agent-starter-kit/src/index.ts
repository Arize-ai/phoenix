/* eslint-disable no-console */
// Initialize Phoenix tracing before any AI SDK calls
import {
  getInputAttributes,
  getOutputAttributes,
  withSpan,
} from "@arizeai/openinference-core";

import { flush, SESSION_ID } from "./instrumentation.js";

import { anthropic } from "@ai-sdk/anthropic";
import {
  cancel,
  intro,
  isCancel,
  log,
  note,
  outro,
  spinner,
  text,
} from "@clack/prompts";
import { stepCountIs, tool, ToolLoopAgent } from "ai";
import { z } from "zod";

// Define tools for the agent
const calculatorTool = tool({
  description: "Perform mathematical calculations",
  inputSchema: z.object({
    expression: z.string().describe("The mathematical expression to evaluate"),
  }),
  execute: async ({ expression }: { expression: string }) => {
    try {
      // Simple eval for demo purposes - in production, use a safe math parser
      const result = eval(expression);
      return { result, expression };
    } catch (error) {
      return { error: String(error), expression };
    }
  },
});

const getDateTimeTool = tool({
  description: "Get the current date and time",
  inputSchema: z.object({}),
  execute: async () => {
    const now = new Date();
    return {
      date: now.toLocaleDateString(),
      time: now.toLocaleTimeString(),
      iso: now.toISOString(),
    };
  },
});

function printWelcome() {
  intro("CLI Agent Starter Kit");

  const toolsAndCommands = `Available tools:
  • Calculator - Perform mathematical calculations
  • Date/Time - Get current date and time

Commands:
  /exit or /quit - Exit the agent
  /help - Show this help message
  /clear - Clear conversation history`;

  note(toolsAndCommands, "Interactive Mode");
  log.info(`Session ID: ${SESSION_ID}`);
}

async function handleExit(cancelled = false) {
  if (cancelled) {
    cancel("Operation cancelled");
  } else {
    outro("Thanks for using CLI Agent Starter Kit!");
  }

  console.log("Flushing traces...");
  await flush();
  process.exit(0);
}

async function processUserMessage(
  input: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  agent: ToolLoopAgent<any, any>,
  conversationHistory: Array<{ role: "user" | "assistant"; content: string }>
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

async function conversationLoop(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  agent: ToolLoopAgent<any, any>,
  conversationHistory: Array<{ role: "user" | "assistant"; content: string }>
) {
  while (true) {
    const userInput = await text({
      message: "You",
      placeholder: "Ask a question or use /help for commands",
    });

    if (isCancel(userInput)) {
      await handleExit(true);
      break;
    }

    const input = (userInput as string).trim();

    // Command handling
    if (input === "/exit" || input === "/quit") {
      await handleExit();
      break;
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

async function main() {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    console.error("Error: ANTHROPIC_API_KEY environment variable is not set");
    await flush();
    process.exit(1);
  }

  printWelcome();

  // Create a ToolLoopAgent with tools
  const agent = new ToolLoopAgent({
    model: anthropic("claude-sonnet-4-20250514"),
    instructions:
      "You are a helpful CLI agent. Use the available tools to answer questions accurately. Be concise and friendly.",
    tools: {
      calculator: calculatorTool,
      getDateTime: getDateTimeTool,
    },
    // Stop after 10 steps max
    stopWhen: stepCountIs(10),
    // Enable telemetry for Phoenix tracing
    experimental_telemetry: { isEnabled: true },
  });

  const conversationHistory: Array<{
    role: "user" | "assistant";
    content: string;
  }> = [];

  // Start conversation loop
  await conversationLoop(agent, conversationHistory);
}

main()
  .then(() => {
    // Allow time for spans to be flushed before exit
    // The beforeExit handler will ensure proper shutdown
  })
  .catch(async (error) => {
    console.error("Fatal error:", error);
    await flush();
    process.exit(1);
  });
