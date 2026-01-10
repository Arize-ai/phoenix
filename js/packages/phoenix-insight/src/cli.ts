#!/usr/bin/env node

import { Command } from "commander";

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
    console.log("Query command not yet implemented");
    console.log("Query:", query);
    console.log("Options:", options);
  });

program.parse();
