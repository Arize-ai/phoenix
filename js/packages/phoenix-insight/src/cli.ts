#!/usr/bin/env node

import { Command } from "commander";
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
  .version(VERSION);

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
  .action(async (query, options) => {
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

program.parse();
