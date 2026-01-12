#!/usr/bin/env node

import { Command } from "commander";
import * as readline from "node:readline";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";
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
import { initializeConfig, getConfig, type CliArgs } from "./config/index.js";

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
  .option(
    "--config <path>",
    "Path to config file (default: ~/.phoenix-insight/config.json, or set PHOENIX_INSIGHT_CONFIG env var)"
  )
  .addHelpText(
    "after",
    `
Configuration:
  Config values are loaded with the following priority (highest to lowest):
    1. CLI arguments (e.g., --base-url)
    2. Environment variables (e.g., PHOENIX_BASE_URL)
    3. Config file (~/.phoenix-insight/config.json)

  Use --config to specify a custom config file path.
  Set PHOENIX_INSIGHT_CONFIG env var to override the default config location.

Examples:
  $ phoenix-insight                                               # Start interactive mode
  $ phoenix-insight "What are the slowest traces?"                # Single query (sandbox mode)
  $ phoenix-insight --interactive                                  # Explicitly start interactive mode
  $ phoenix-insight --local "Show me error patterns"              # Local mode with persistence
  $ phoenix-insight --local --stream "Analyze recent experiments"  # Local mode with streaming
  $ phoenix-insight --config ./my-config.json "Analyze traces"    # Use custom config file
  $ phoenix-insight help                                          # Show this help message
`
  )
  .hook("preAction", async (thisCommand) => {
    // Get all options from the root command
    const opts = thisCommand.opts();
    // Build CLI args from commander options
    const cliArgs: CliArgs = {
      config: opts.config,
      baseUrl: opts.baseUrl,
      apiKey: opts.apiKey,
      limit: opts.limit,
      stream: opts.stream,
      local: opts.local,
      refresh: opts.refresh,
      trace: opts.trace,
    };
    // Initialize config singleton before any command runs
    await initializeConfig(cliArgs);
  });

program
  .command("snapshot")
  .description("Create a snapshot of Phoenix data")
  .action(async () => {
    const config = getConfig();

    // Initialize observability if trace is enabled in config
    if (config.trace) {
      initializeObservability({
        enabled: true,
        baseUrl: config.baseUrl,
        apiKey: config.apiKey,
        projectName: "phoenix-insight-snapshot",
        debug: !!process.env.DEBUG,
      });
    }

    try {
      // Determine the execution mode
      const mode: ExecutionMode = await createLocalMode();

      // Create snapshot with config values
      const snapshotOptions = {
        baseURL: config.baseUrl,
        apiKey: config.apiKey,
        spansPerProject: config.limit,
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
  .command("help")
  .description("Show help information")
  .action(() => {
    program.outputHelp();
  });

program
  .command("prune")
  .description("Delete the local snapshot directory (~/.phoenix-insight/)")
  .option("--dry-run", "Show what would be deleted without actually deleting")
  .action(async (options) => {
    const snapshotDir = path.join(os.homedir(), ".phoenix-insight");

    try {
      // Check if the directory exists
      const stats = await fs.stat(snapshotDir).catch(() => null);

      if (!stats) {
        console.log("📁 No local snapshot directory found. Nothing to prune.");
        return;
      }

      if (options.dryRun) {
        console.log("🔍 Dry run mode - would delete:");
        console.log(`   ${snapshotDir}`);

        // Show size and count of snapshots
        const snapshots = await fs
          .readdir(path.join(snapshotDir, "snapshots"))
          .catch(() => []);
        console.log(`   📊 Contains ${snapshots.length} snapshot(s)`);

        return;
      }

      // Ask for confirmation
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      const answer = await new Promise<string>((resolve) => {
        rl.question(
          `⚠️  This will delete all local snapshots at:\n   ${snapshotDir}\n\n   Are you sure? (yes/no): `,
          resolve
        );
      });

      rl.close();

      if (answer.toLowerCase() !== "yes" && answer.toLowerCase() !== "y") {
        console.log("❌ Prune cancelled.");
        return;
      }

      // Delete the directory
      await fs.rm(snapshotDir, { recursive: true, force: true });
      console.log("✅ Local snapshot directory deleted successfully!");
    } catch (error) {
      console.error("❌ Error pruning snapshots:");
      console.error(
        `   ${error instanceof Error ? error.message : String(error)}`
      );
      process.exit(1);
    }
  });

program
  .argument("[query]", "Query to run against Phoenix data")
  .option(
    "--sandbox",
    "Run in sandbox mode with in-memory filesystem (default)"
  )
  .option("--local", "Run in local mode with real filesystem")
  .option("--base-url <url>", "Phoenix base URL")
  .option("--api-key <key>", "Phoenix API key")
  .option("--refresh", "Force refresh of snapshot data")
  .option("--limit <number>", "Limit number of spans to fetch", parseInt)
  .option("--stream [true|false]", "Stream agent responses", (v) =>
    ["f", "false"].includes(v.toLowerCase()) ? false : true
  )
  .option("-i, --interactive", "Run in interactive mode (REPL)")
  .option("--trace", "Enable tracing of the agent to Phoenix")
  .action(async (query, options) => {
    const config = getConfig();
    // If interactive mode is requested, ignore query argument
    if (options.interactive) {
      await runInteractiveMode();
      return;
    }

    // If no query is provided and no specific flag, start interactive mode
    if (!query && !options.help) {
      await runInteractiveMode();
      return;
    }

    // Initialize observability if trace is enabled in config
    if (config.trace) {
      initializeObservability({
        enabled: true,
        baseUrl: config.baseUrl,
        apiKey: config.apiKey,
        projectName: "phoenix-insight",
        debug: !!process.env.DEBUG,
      });
    }

    try {
      // Determine the execution mode
      const mode: ExecutionMode =
        config.mode === "local" ? await createLocalMode() : createSandboxMode();

      // Create Phoenix client
      const client = createPhoenixClient({
        baseURL: config.baseUrl,
        apiKey: config.apiKey,
      });

      // Create or update snapshot
      const snapshotOptions = {
        baseURL: config.baseUrl,
        apiKey: config.apiKey,
        spansPerProject: config.limit,
        showProgress: true,
      };

      if (config.refresh || config.mode !== "local") {
        // For sandbox mode (default) or when refresh is requested, always create a fresh snapshot
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
      const agentProgress = new AgentProgress(!config.stream);
      agentProgress.startThinking();

      if (config.stream) {
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
                console.log();
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
              console.log();
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

async function runInteractiveMode(): Promise<void> {
  const config = getConfig();

  console.log("🚀 Phoenix Insight Interactive Mode");
  console.log(
    "Type your queries below. Type 'help' for available commands or 'exit' to quit.\n"
  );

  // Prevent the process from exiting on unhandled promise rejections
  process.on("unhandledRejection", (reason, promise) => {
    console.error("\n⚠️  Unhandled promise rejection:", reason);
    console.error(
      "The interactive mode will continue. You can try another query."
    );
  });

  // Initialize observability if trace is enabled in config
  if (config.trace) {
    initializeObservability({
      enabled: true,
      baseUrl: config.baseUrl,
      apiKey: config.apiKey,
      projectName: "phoenix-insight",
      debug: !!process.env.DEBUG,
    });
  }

  // Setup mode and snapshot once for the session
  let mode: ExecutionMode;
  let agent: any;

  try {
    // Determine the execution mode
    mode =
      config.mode === "local" ? await createLocalMode() : createSandboxMode();

    // Create Phoenix client
    const client = createPhoenixClient({
      baseURL: config.baseUrl,
      apiKey: config.apiKey,
    });

    // Create or update snapshot
    const snapshotOptions = {
      baseURL: config.baseUrl,
      apiKey: config.apiKey,
      spansPerProject: config.limit,
      showProgress: true,
    };

    if (config.refresh || config.mode !== "local") {
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
      terminal: true, // Ensure terminal mode for better compatibility
    });

    let userExited = false;

    // Handle SIGINT (Ctrl+C) gracefully
    rl.on("SIGINT", () => {
      if (userExited) {
        process.exit(0);
      }
      console.log(
        '\n\nUse "exit" to quit or press Ctrl+C again to force exit.'
      );
      userExited = true;
      rl.prompt();
    });

    // Helper function to process a single query
    const processQuery = async (query: string): Promise<boolean> => {
      if (query === "exit" || query === "quit") {
        return true; // Signal to exit
      }

      if (query === "help") {
        console.log("\n📖 Interactive Mode Commands:");
        console.log("   help              - Show this help message");
        console.log("   exit, quit        - Exit interactive mode");
        console.log(
          "   px-fetch-more     - Fetch additional data (e.g., px-fetch-more spans --project <name> --limit <n>)"
        );
        console.log("\n💡 Usage Tips:");
        console.log(
          "   • Ask natural language questions about your Phoenix data"
        );
        console.log(
          "   • The agent has access to bash commands to analyze the data"
        );
        console.log(
          "   • Use px-fetch-more commands to get additional data on-demand"
        );
        console.log("\n🔧 Options (set when starting phoenix-insight):");
        console.log(
          "   --local           - Use local mode with persistent storage"
        );
        console.log(
          "   --stream          - Stream agent responses in real-time"
        );
        console.log("   --refresh         - Force fresh snapshot data");
        console.log("   --limit <n>       - Set max spans per project");
        console.log("   --trace           - Enable observability tracing");
        return false;
      }

      if (query === "") {
        return false;
      }

      try {
        const agentProgress = new AgentProgress(!config.stream);
        agentProgress.startThinking();

        if (config.stream) {
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

        console.log("\n" + "─".repeat(50) + "\n");
      } catch (error) {
        console.error("\n❌ Query Error:");
        if (error instanceof PhoenixClientError) {
          console.error(`   ${error.message}`);
        } else if (error instanceof Error) {
          console.error(`   ${error.message}`);
        } else {
          console.error(`   ${String(error)}`);
        }
        console.error("   You can try again with a different query\n");
      }

      return false;
    };

    // Use event-based approach instead of async iterator to prevent
    // premature exit when ora/spinners interact with stdin
    await new Promise<void>((resolve) => {
      rl.on("line", async (line) => {
        const query = line.trim();

        // Pause readline while processing to prevent queuing
        rl.pause();

        const shouldExit = await processQuery(query);

        if (shouldExit) {
          rl.close();
        } else {
          // Resume and show prompt for next input
          rl.resume();
          rl.prompt();
        }
      });

      rl.on("close", () => {
        resolve();
      });

      // Show initial prompt
      rl.prompt();
    });

    console.log("\n👋 Goodbye!");

    // Cleanup
    await mode.cleanup();

    // Shutdown observability if enabled
    await shutdownObservability();
  } catch (error) {
    handleError(error, "setting up interactive mode");
  }
}

program.parse();
