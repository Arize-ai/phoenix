/* eslint-disable no-console */
// Initialize Phoenix tracing before any AI SDK calls
import { flush } from "./instrumentation.js";

import { anthropic } from "@ai-sdk/anthropic";
import { stepCountIs, tool, ToolLoopAgent } from "ai";
import * as readline from "node:readline";
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
  console.log("╔═══════════════════════════════════════════════════════════╗");
  console.log("║         CLI Agent Starter Kit - Interactive Mode         ║");
  console.log("╚═══════════════════════════════════════════════════════════╝");
  console.log("\nAvailable tools:");
  console.log("  • Calculator - Perform mathematical calculations");
  console.log("  • Date/Time - Get current date and time");
  console.log("\nCommands:");
  console.log("  /exit or /quit - Exit the agent");
  console.log("  /help - Show this help message");
  console.log("  /clear - Clear conversation history");
  console.log("\n");
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

  // Create readline interface for user input
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: "\n\x1b[36mYou:\x1b[0m ",
  });

  let conversationHistory: Array<{
    role: "user" | "assistant";
    content: string;
  }> = [];

  rl.prompt();

  rl.on("line", async (input) => {
    const userInput = input.trim();

    // Handle commands
    if (userInput === "/exit" || userInput === "/quit") {
      console.log("\n\x1b[33mGoodbye!\x1b[0m\n");
      rl.close();
      return;
    }

    if (userInput === "/help") {
      printWelcome();
      rl.prompt();
      return;
    }

    if (userInput === "/clear") {
      conversationHistory = [];
      console.log("\n\x1b[33m✓ Conversation history cleared\x1b[0m");
      rl.prompt();
      return;
    }

    if (!userInput) {
      rl.prompt();
      return;
    }

    // Add user message to history
    conversationHistory.push({ role: "user", content: userInput });

    try {
      let stepNumber = 0;
      const verbose = process.env.VERBOSE === "true";

      console.log("\x1b[35mAgent:\x1b[0m");

      // Run the agent with conversation history
      const result = await agent.generate({
        prompt: conversationHistory
          .map(
            (msg) =>
              `${msg.role === "user" ? "User" : "Assistant"}: ${msg.content}`
          )
          .join("\n\n"),
        // Log each step if verbose mode
        onStepFinish: async ({ usage, finishReason, toolCalls }) => {
          if (verbose) {
            stepNumber++;
            console.log(
              `\x1b[90m[Step ${stepNumber}] ${finishReason} - ${toolCalls?.map((tc) => tc.toolName).join(", ") || "no tools"}\x1b[0m`
            );
          }
        },
      });

      // Add assistant response to history
      conversationHistory.push({ role: "assistant", content: result.text });

      console.log(result.text);

      if (verbose) {
        console.log(`\x1b[90m(${result.steps.length} steps)\x1b[0m`);
      }
    } catch (error) {
      console.error("\n\x1b[31mError:\x1b[0m", error);
    }

    rl.prompt();
  });

  rl.on("close", async () => {
    console.log("\nFlushing traces...");
    await flush();
    process.exit(0);
  });
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
