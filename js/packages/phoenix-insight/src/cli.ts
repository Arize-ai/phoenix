#!/usr/bin/env node

import { Command } from "commander";
import * as readline from "node:readline";
import { createSandboxMode, createLocalMode } from "./modes/index.js";
import { createInsightAgent, runOneShotQuery } from "./agent/index.js";
import {
  createSnapshot,
  createIncrementalSnapshot,
  createPhoenixClient,
} from "./snapshot/index.js";
import type { ExecutionMode } from "./modes/types.js";
import type { PhoenixInsightAgentConfig } from "./agent/index.js";

// Version will be read from package.json during build
const VERSION = "0.0.1";

const program = new Command();

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
  .action(async (options) => {
    console.log("Snapshot command not yet implemented");
    console.log("Options:", options);
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
  .action(async (query, options) => {
    // If interactive mode is requested, ignore query argument
    if (options.interactive) {
      await runInteractiveMode(options);
      return;
    }

    if (!query) {
      program.help();
      return;
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
        console.log("Creating Phoenix data snapshot...");
        await createSnapshot(mode, snapshotOptions);
      } else {
        // For local mode without refresh, try incremental update
        console.log("Updating Phoenix data snapshot...");
        await createIncrementalSnapshot(mode, snapshotOptions);
      }

      // Create agent configuration
      const agentConfig: PhoenixInsightAgentConfig = {
        mode,
        client,
        maxSteps: 25,
      };

      // Execute the query
      console.log("\nExecuting query...\n");

      if (options.stream) {
        // Stream mode
        const result = await runOneShotQuery(agentConfig, query, {
          stream: true,
          onStepStart: (step) => {
            if (step.toolCalls?.length) {
              console.log(
                `\n🔧 Using tools: ${step.toolCalls.map((tc: any) => tc.toolName).join(", ")}`
              );
            }
          },
          onStepFinish: (step) => {
            if (step.toolResults?.length) {
              for (const result of step.toolResults) {
                if (result.toolName === "bash" && result.result?.stdout) {
                  console.log(`\n📄 Output:\n${result.result.stdout}`);
                }
              }
            }
          },
        });

        // Handle streaming response
        for await (const chunk of result.textStream) {
          process.stdout.write(chunk);
        }
        console.log(); // Final newline

        // Wait for full response to complete
        await result.response;
      } else {
        // Non-streaming mode
        const result = await runOneShotQuery(agentConfig, query, {
          onStepStart: (step) => {
            if (step.toolCalls?.length) {
              console.log(
                `\n🔧 Using tools: ${step.toolCalls.map((tc: any) => tc.toolName).join(", ")}`
              );
            }
          },
          onStepFinish: (step) => {
            if (step.toolResults?.length) {
              for (const result of step.toolResults) {
                if (result.toolName === "bash" && result.result?.stdout) {
                  console.log(`\n📄 Output:\n${result.result.stdout}`);
                }
              }
            }
          },
        });

        // Display the final answer
        console.log("\n✨ Answer:\n");
        console.log(result.text);
      }

      // Cleanup
      await mode.cleanup();

      console.log("\n✅ Done!");
    } catch (error) {
      console.error("\n❌ Error:", error);
      process.exit(1);
    }
  });

async function runInteractiveMode(options: any): Promise<void> {
  console.log("🚀 Phoenix Insight Interactive Mode");
  console.log("Type your queries below. Type 'exit' or 'quit' to end.\n");

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
      console.log("Creating Phoenix data snapshot...");
      await createSnapshot(mode, snapshotOptions);
    } else {
      console.log("Updating Phoenix data snapshot...");
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
    agent = createInsightAgent(agentConfig);

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
        console.log("\n🤔 Analyzing...\n");

        if (options.stream) {
          // Stream mode
          const result = await agent.stream({
            prompt: query,
            onStepStart: (step: any) => {
              if (step.toolCalls?.length) {
                console.log(
                  `🔧 Using tools: ${step.toolCalls.map((tc: any) => tc.toolName).join(", ")}`
                );
              }
            },
            onStepFinish: (step: any) => {
              if (step.toolResults?.length) {
                for (const result of step.toolResults) {
                  if (result.toolName === "bash" && result.result?.stdout) {
                    console.log(`📄 Output:\n${result.result.stdout}`);
                  }
                }
              }
            },
          });

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
          const result = await agent.generate({
            prompt: query,
            onStepStart: (step: any) => {
              if (step.toolCalls?.length) {
                console.log(
                  `🔧 Using tools: ${step.toolCalls.map((tc: any) => tc.toolName).join(", ")}`
                );
              }
            },
            onStepFinish: (step: any) => {
              if (step.toolResults?.length) {
                for (const result of step.toolResults) {
                  if (result.toolName === "bash" && result.result?.stdout) {
                    console.log(`📄 Output:\n${result.result.stdout}`);
                  }
                }
              }
            },
          });

          // Display the final answer
          console.log("\n✨ Answer:\n");
          console.log(result.text);
        }
      } catch (error) {
        console.error("\n❌ Error:", error);
      }

      console.log("\n" + "─".repeat(50) + "\n");
      rl.prompt();
    }

    // Cleanup
    await mode.cleanup();
  } catch (error) {
    console.error("\n❌ Error setting up interactive mode:", error);
    process.exit(1);
  }
}

program.parse();
