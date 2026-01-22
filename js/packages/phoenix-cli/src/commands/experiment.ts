import type { PhoenixClient } from "@arizeai/phoenix-client";

import { createPhoenixClient } from "../client";
import { getConfigErrorMessage, resolveConfig } from "../config";
import { writeError, writeOutput, writeProgress } from "../io";

import {
  formatExperimentJsonOutput,
  type OutputFormat,
} from "./formatExperiment";

import { Command } from "commander";
import * as fs from "fs";

interface ExperimentOptions {
  endpoint?: string;
  apiKey?: string;
  format?: OutputFormat;
  progress?: boolean;
  file?: string;
}

/**
 * Download experiment JSON data
 */
async function downloadExperimentJson(
  client: PhoenixClient,
  experimentId: string
): Promise<string> {
  const response = await client.GET("/v1/experiments/{experiment_id}/json", {
    params: {
      path: {
        experiment_id: experimentId,
      },
    },
    parseAs: "text",
  });

  if (response.error || response.data === undefined) {
    throw new Error(`Failed to download experiment: ${response.error}`);
  }

  return response.data as string;
}

/**
 * Experiment command handler
 */
async function experimentHandler(
  experimentId: string,
  options: ExperimentOptions
): Promise<void> {
  try {
    const userSpecifiedFormat =
      process.argv.includes("--format") ||
      process.argv.some((arg) => arg.startsWith("--format="));

    // Resolve configuration
    const config = resolveConfig({
      cliOptions: {
        endpoint: options.endpoint,
        apiKey: options.apiKey,
      },
    });

    // Validate that we have endpoint
    if (!config.endpoint) {
      const errors = [
        "Phoenix endpoint not configured. Set PHOENIX_HOST environment variable or use --endpoint flag.",
      ];
      writeError({ message: getConfigErrorMessage({ errors }) });
      process.exit(1);
    }

    // Create client
    const client = createPhoenixClient({ config });

    writeProgress({
      message: `Fetching experiment ${experimentId}...`,
      noProgress: !options.progress,
    });

    // Download experiment JSON
    const jsonData = await downloadExperimentJson(client, experimentId);

    writeProgress({
      message: `Downloaded experiment data`,
      noProgress: !options.progress,
    });

    // Determine output format
    const outputFormat: OutputFormat = options.file
      ? "json"
      : options.format || "pretty";

    if (options.file && userSpecifiedFormat && options.format !== "json") {
      writeError({
        message: `Warning: --format is ignored when writing to a file; writing JSON to ${options.file}`,
      });
    }

    // Format output
    const output = formatExperimentJsonOutput({
      jsonData,
      format: outputFormat,
    });

    if (options.file) {
      fs.writeFileSync(options.file, output, "utf-8");
      writeProgress({
        message: `Wrote experiment to ${options.file}`,
        noProgress: !options.progress,
      });
    } else {
      writeOutput({ message: output });
    }
  } catch (error) {
    writeError({
      message: `Error fetching experiment: ${error instanceof Error ? error.message : String(error)}`,
    });
    process.exit(1);
  }
}

/**
 * Create the experiment command
 */
export function createExperimentCommand(): Command {
  const command = new Command("experiment");

  command
    .description("Fetch a specific experiment by ID with all run data")
    .argument("<experiment-id>", "Experiment identifier")
    .option("--endpoint <url>", "Phoenix API endpoint")
    .option("--api-key <key>", "Phoenix API key for authentication")
    .option(
      "--format <format>",
      "Output format: pretty, json, or raw",
      "pretty"
    )
    .option("--no-progress", "Disable progress indicators")
    .option("--file <path>", "Save experiment to file instead of stdout")
    .action(experimentHandler);

  return command;
}
