#!/usr/bin/env node

import { Command } from "commander";
import * as readline from "node:readline";
import { createSandboxMode, createLocalMode } from "./modes/index.js";
import { createInsightAgent, runOneShotQuery } from "./agent/index.js";
import {
  createSnapshot,
  createIncrementalSnapshot,
  createPhoenixClient,
  PhoenixClientError,
} from "./snapshot/index.js";
import type { ExecutionMode } from "./modes/types.js";
import type { PhoenixInsightAgentConfig } from "./agent/index.js";
import { AgentProgress } from "./progress.js";
import {
  initializeObservability,
  shutdownObservability,
} from "./observability/index.js";

// Version will be read from package.json during build
const VERSION = "0.0.1";

const program = new Command();

/**
 * Format bash command for display in progress indicator
 */
function formatBashCommand(command: string): string {
  if (!command) return "";

  // Split by newline and get first line
  const lines = command.split("\n");
  const firstLine = lines[0]?.trim() || "";

  // Check for pipeline first (3+ commands)
  if (firstLine.includes(" | ") && firstLine.split(" | ").length > 2) {
    const parts = firstLine.split(" | ");
    const firstCmd = parts[0]?.split(" ")[0] || "";
    const lastCmd = parts[parts.length - 1]?.split(" ")[0] || "";
    return `${firstCmd} | ... | ${lastCmd}`;
  }

  // Common command patterns to display nicely
  if (firstLine.startsWith("cat ")) {
    const file = firstLine.substring(4).trim();
    return `cat ${file}`;
  } else if (firstLine.startsWith("grep ")) {
    // Extract pattern and file/directory
    const match = firstLine.match(
      /grep\s+(?:-[^\s]+\s+)*['"]?([^'"]+)['"]?\s+(.+)/
    );
    if (match && match[1] && match[2]) {
      return `grep "${match[1]}" in ${match[2]}`;
    }
    return firstLine.substring(0, 60) + (firstLine.length > 60 ? "..." : "");
  } else if (firstLine.startsWith("find ")) {
    const match = firstLine.match(
      /find\s+([^\s]+)(?:\s+-name\s+['"]?([^'"]+)['"]?)?/
    );
    if (match && match[1]) {
      return match[2]
        ? `find "${match[2]}" in ${match[1]}`
        : `find in ${match[1]}`;
    }
    return firstLine.substring(0, 60) + (firstLine.length > 60 ? "..." : "");
  } else if (firstLine.startsWith("ls ")) {
    const path = firstLine.substring(3).trim();
    return path ? `ls ${path}` : "ls";
  } else if (firstLine.startsWith("ls")) {
    return "ls";
  } else if (firstLine.startsWith("jq ")) {
    return `jq processing JSON data`;
  } else if (firstLine.startsWith("head ") || firstLine.startsWith("tail ")) {
    const cmd = firstLine.split(" ")[0];
    const fileMatch = firstLine.match(/(?:head|tail)\s+(?:-[^\s]+\s+)*(.+)/);
    if (fileMatch && fileMatch[1]) {
      return `${cmd} ${fileMatch[1]}`;
    }
    return firstLine.substring(0, 60) + (firstLine.length > 60 ? "..." : "");
  } else {
    // For other commands, show up to 80 characters
    return firstLine.substring(0, 80) + (firstLine.length > 80 ? "..." : "");
  }
}

/**
 * Handle errors with appropriate exit codes and user-friendly messages
 */
function handleError(error: unknown, context: string): never {
  console.error(`\n❌ Error ${context}:`);

  if (error instanceof PhoenixClientError) {
    switch (error.code) {
      case "NETWORK_ERROR":
        console.error(
          "\n🌐 Network Error: Unable to connect to Phoenix server"
        );
        console.error(`   Make sure Phoenix is running and accessible`);
        console.error(`   You can specify a different URL with --base-url`);
        break;
      case "AUTH_ERROR":
        console.error("\n🔒 Authentication Error: Invalid or missing API key");
        console.error(
          `   Set the PHOENIX_API_KEY environment variable or use --api-key`
        );
        break;
      case "INVALID_RESPONSE":
        console.error(
          "\n⚠️  Invalid Response: Phoenix returned unexpected data"
        );
        console.error(`   This might be a version compatibility issue`);
        break;
      default:
        console.error("\n❓ Phoenix Client Error:", error.message);
    }
    if (error.originalError && process.env.DEBUG) {
      console.error("\nOriginal error:", error.originalError);
    }
  } else if (error instanceof Error) {
    // Check for specific error patterns
    if (error.message.includes("ENOENT")) {
      console.error(
        "\n📁 File System Error: Required file or directory not found"
      );
      console.error(`   ${error.message}`);
    } else if (
      error.message.includes("EACCES") ||
      error.message.includes("EPERM")
    ) {
      console.error("\n🚫 Permission Error: Insufficient permissions");
      console.error(`   ${error.message}`);
      if (error.message.includes(".phoenix-insight")) {
        console.error(
          `   Try running with appropriate permissions or check ~/.phoenix-insight/`
        );
      }
    } else if (
      error.message.includes("rate limit") ||
      error.message.includes("429")
    ) {
      console.error("\n⏱️  Rate Limit Error: Too many requests to Phoenix");
      console.error(`   Please wait a moment and try again`);
    } else if (error.message.includes("timeout")) {
      console.error("\n⏰ Timeout Error: Request took too long");
      console.error(`   The Phoenix server might be slow or unresponsive`);
    } else {
      console.error(`\n${error.message}`);
    }

    if (error.stack && process.env.DEBUG) {
      console.error("\nStack trace:", error.stack);
    }
  } else {
    console.error("\nUnexpected error:", error);
  }

  console.error("\n💡 Tips:");
  console.error("   • Run with DEBUG=1 for more detailed error information");
  console.error(
    "   • Check your Phoenix connection with: phoenix-insight snapshot --base-url <url>"
  );
  console.error("   • Use --help to see all available options");

  process.exit(1);
}

program
  .name("phoenix-insight")
  .description("A CLI for Phoenix data analysis with AI agents")
  .version(VERSION)
  .usage("[options] [query]")
  .addHelpText(
    "after",
    `
Examples:
  $ phoenix-insight "What are the slowest traces?"                # Single query
  $ phoenix-insight --interactive                                  # Interactive REPL mode
  $ phoenix-insight --sandbox "Show me error patterns"             # Sandbox mode (safe)
  $ phoenix-insight --local --stream "Analyze recent experiments"  # Local mode with streaming
`
  );

program
  .command("snapshot")
  .description("Create a snapshot of Phoenix data")
  .option(
    "--base-url <url>",
    "Phoenix base URL",
    process.env.PHOENIX_BASE_URL || "http://localhost:6006"
  )
  .option("--api-key <key>", "Phoenix API key", process.env.PHOENIX_API_KEY)
  .option("--refresh", "Force refresh of snapshot data")
  .option("--trace", "Enable tracing of the snapshot process to Phoenix")
  .action(async (options) => {
    // Initialize observability if --trace flag is set
    if (options.trace) {
      initializeObservability({
        enabled: true,
        baseUrl: options.baseUrl,
        apiKey: options.apiKey,
        projectName: "phoenix-insight-snapshot",
        debug: !!process.env.DEBUG,
      });
    }

    try {
      // Determine the execution mode
      const mode: ExecutionMode = await createLocalMode();

      // Create snapshot with the provided options
      const snapshotOptions = {
        baseURL: options.baseUrl,
        apiKey: options.apiKey,
        spansPerProject: 1000,
        showProgress: true,
      };

      await createSnapshot(mode, snapshotOptions);

      // Cleanup
      await mode.cleanup();

      // Shutdown observability if enabled
      await shutdownObservability();
    } catch (error) {
      handleError(error, "creating snapshot");
    }
  });

program
  .argument("[query]", "Query to run against Phoenix data")
  .option("--sandbox", "Run in sandbox mode with in-memory filesystem")
  .option("--local", "Run in local mode with real filesystem (default)")
  .option(
    "--base-url <url>",
    "Phoenix base URL",
    process.env.PHOENIX_BASE_URL || "http://localhost:6006"
  )
  .option("--api-key <key>", "Phoenix API key", process.env.PHOENIX_API_KEY)
  .option("--refresh", "Force refresh of snapshot data")
  .option("--limit <number>", "Limit number of spans to fetch", parseInt)
  .option("--stream", "Stream agent responses")
  .option("-i, --interactive", "Run in interactive mode (REPL)")
  .option("--trace", "Enable tracing of the agent to Phoenix")
  .action(async (query, options) => {
    // If interactive mode is requested, ignore query argument
    if (options.interactive) {
      await runInteractiveMode(options);
      return;
    }

    if (!query && !options.help) {
      program.outputHelp();
      return;
    }

    // Initialize observability if --trace flag is set
    if (options.trace) {
      initializeObservability({
        enabled: true,
        baseUrl: options.baseUrl,
        apiKey: options.apiKey,
        projectName: "phoenix-insight",
        debug: !!process.env.DEBUG,
      });
    }

    try {
      // Determine the execution mode
      const mode: ExecutionMode = options.sandbox
        ? createSandboxMode()
        : await createLocalMode();

      // Create Phoenix client
      const client = createPhoenixClient({
        baseURL: options.baseUrl,
        apiKey: options.apiKey,
      });

      // Create or update snapshot
      const snapshotOptions = {
        baseURL: options.baseUrl,
        apiKey: options.apiKey,
        spansPerProject: options.limit || 1000,
        showProgress: true,
      };

      if (options.refresh || options.sandbox) {
        // For sandbox mode or when refresh is requested, always create a fresh snapshot
        await createSnapshot(mode, snapshotOptions);
      } else {
        // For local mode without refresh, try incremental update
        await createIncrementalSnapshot(mode, snapshotOptions);
      }

      // Create agent configuration
      const agentConfig: PhoenixInsightAgentConfig = {
        mode,
        client,
        maxSteps: 25,
      };

      // Execute the query
      const agentProgress = new AgentProgress(!options.stream);
      agentProgress.startThinking();

      if (options.stream) {
        // Stream mode
        const result = (await runOneShotQuery(agentConfig, query, {
          stream: true,
          onStepFinish: (step) => {
            // Show tool usage even in stream mode
            if (step.toolCalls?.length) {
              step.toolCalls.forEach((toolCall: any) => {
                const toolName = toolCall.toolName;
                if (toolName === "bash") {
                  // Extract bash command for better visibility
                  const command = toolCall.args?.command || "";
                  const formattedCmd = formatBashCommand(command);
                  agentProgress.updateTool(toolName, formattedCmd);
                } else {
                  agentProgress.updateTool(toolName);
                }
              });
            }

            // Show tool results
            if (step.toolResults?.length) {
              step.toolResults.forEach((toolResult: any) => {
                agentProgress.updateToolResult(
                  toolResult.toolName,
                  !toolResult.isError
                );
              });
            }
          },
        })) as any; // Type assertion needed due to union type

        // Stop progress before streaming
        agentProgress.stop();

        // Handle streaming response
        console.log("\n✨ Answer:\n");
        for await (const chunk of result.textStream) {
          process.stdout.write(chunk);
        }
        console.log(); // Final newline

        // Wait for full response to complete
        await result.response;
      } else {
        // Non-streaming mode
        const result = (await runOneShotQuery(agentConfig, query, {
          onStepFinish: (step) => {
            // Show tool usage
            if (step.toolCalls?.length) {
              step.toolCalls.forEach((toolCall: any) => {
                const toolName = toolCall.toolName;
                if (toolName === "bash") {
                  // Extract bash command for better visibility
                  const command = toolCall.args?.command || "";
                  const formattedCmd = formatBashCommand(command);
                  agentProgress.updateTool(toolName, formattedCmd);
                } else {
                  agentProgress.updateTool(toolName);
                }
              });
            }

            // Show tool results
            if (step.toolResults?.length) {
              step.toolResults.forEach((toolResult: any) => {
                agentProgress.updateToolResult(
                  toolResult.toolName,
                  !toolResult.isError
                );
              });
            }
          },
        })) as any; // Type assertion needed due to union type

        // Stop progress and display the final answer
        agentProgress.succeed();
        console.log("\n✨ Answer:\n");
        console.log(result.text);
      }

      // Cleanup
      await mode.cleanup();

      console.log("\n✅ Done!");
    } catch (error) {
      handleError(error, "executing query");
    } finally {
      // Shutdown observability if enabled
      await shutdownObservability();
    }
  });

async function runInteractiveMode(options: any): Promise<void> {
  console.log("🚀 Phoenix Insight Interactive Mode");
  console.log("Type your queries below. Type 'exit' or 'quit' to end.\n");

  // Initialize observability if --trace flag is set
  if (options.trace) {
    initializeObservability({
      enabled: true,
      baseUrl: options.baseUrl,
      apiKey: options.apiKey,
      projectName: "phoenix-insight",
      debug: !!process.env.DEBUG,
    });
  }

  // Setup mode and snapshot once for the session
  let mode: ExecutionMode;
  let agent: any;

  try {
    // Determine the execution mode
    mode = options.sandbox ? createSandboxMode() : await createLocalMode();

    // Create Phoenix client
    const client = createPhoenixClient({
      baseURL: options.baseUrl,
      apiKey: options.apiKey,
    });

    // Create or update snapshot
    const snapshotOptions = {
      baseURL: options.baseUrl,
      apiKey: options.apiKey,
      spansPerProject: options.limit || 1000,
      showProgress: true,
    };

    if (options.refresh || options.sandbox) {
      await createSnapshot(mode, snapshotOptions);
    } else {
      await createIncrementalSnapshot(mode, snapshotOptions);
    }

    console.log(
      "\n✅ Snapshot ready. You can now ask questions about your Phoenix data.\n"
    );

    // Create agent configuration
    const agentConfig: PhoenixInsightAgentConfig = {
      mode,
      client,
      maxSteps: 25,
    };

    // Create reusable agent
    agent = await createInsightAgent(agentConfig);

    // Setup readline interface
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: "phoenix> ",
    });

    rl.prompt();

    for await (const line of rl) {
      const query = line.trim();

      if (query === "exit" || query === "quit") {
        console.log("\n👋 Goodbye!");
        rl.close();
        break;
      }

      if (query === "") {
        rl.prompt();
        continue;
      }

      try {
        const agentProgress = new AgentProgress(!options.stream);
        agentProgress.startThinking();

        if (options.stream) {
          // Stream mode
          const result = await agent.stream(query, {
            onStepFinish: (step: any) => {
              // Show tool usage even in stream mode
              if (step.toolCalls?.length) {
                step.toolCalls.forEach((toolCall: any) => {
                  const toolName = toolCall.toolName;
                  if (toolName === "bash") {
                    // Extract bash command for better visibility
                    const command = toolCall.args?.command || "";
                    const shortCmd = command.split("\n")[0].substring(0, 50);
                    agentProgress.updateTool(
                      toolName,
                      shortCmd + (command.length > 50 ? "..." : "")
                    );
                  } else {
                    agentProgress.updateTool(toolName);
                  }
                });
              }

              // Show tool results
              if (step.toolResults?.length) {
                step.toolResults.forEach((toolResult: any) => {
                  agentProgress.updateToolResult(
                    toolResult.toolName,
                    !toolResult.isError
                  );
                });
              }
            },
          });

          // Stop progress before streaming
          agentProgress.stop();

          // Handle streaming response
          console.log("\n✨ Answer:\n");
          for await (const chunk of result.textStream) {
            process.stdout.write(chunk);
          }
          console.log(); // Final newline

          // Wait for full response to complete
          await result.response;
        } else {
          // Non-streaming mode
          const result = await agent.generate(query, {
            onStepFinish: (step: any) => {
              // Show tool usage
              if (step.toolCalls?.length) {
                step.toolCalls.forEach((toolCall: any) => {
                  const toolName = toolCall.toolName;
                  if (toolName === "bash") {
                    // Extract bash command for better visibility
                    const command = toolCall.args?.command || "";
                    const shortCmd = command.split("\n")[0].substring(0, 50);
                    agentProgress.updateTool(
                      toolName,
                      shortCmd + (command.length > 50 ? "..." : "")
                    );
                  } else {
                    agentProgress.updateTool(toolName);
                  }
                });
              }

              // Show tool results
              if (step.toolResults?.length) {
                step.toolResults.forEach((toolResult: any) => {
                  agentProgress.updateToolResult(
                    toolResult.toolName,
                    !toolResult.isError
                  );
                });
              }
            },
          });

          // Stop progress and display the final answer
          agentProgress.succeed();
          console.log("\n✨ Answer:\n");
          console.log(result.text);
        }
      } catch (error) {
        console.error("\n❌ Query Error:");
        if (error instanceof PhoenixClientError) {
          console.error(`   ${error.message}`);
        } else if (error instanceof Error) {
          console.error(`   ${error.message}`);
        } else {
          console.error(`   ${String(error)}`);
        }
        console.error("   You can try again with a different query");
      }

      console.log("\n" + "─".repeat(50) + "\n");
      rl.prompt();
    }

    // Cleanup
    await mode.cleanup();

    // Shutdown observability if enabled
    await shutdownObservability();
  } catch (error) {
    handleError(error, "setting up interactive mode");
  }
}

program.parse();
