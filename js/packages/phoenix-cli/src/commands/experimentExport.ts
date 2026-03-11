import * as fs from "fs";
import type { PhoenixClient } from "@arizeai/phoenix-client";
import { Command } from "commander";

import { createPhoenixClient } from "../client";
import { getConfigErrorMessage, resolveConfig } from "../config";
import { writeError, writeOutput, writeProgress } from "../io";

export type ExportFormat = "csv" | "json";

interface ExperimentExportOptions {
  endpoint?: string;
  apiKey?: string;
  format?: ExportFormat;
  output?: string;
  progress?: boolean;
}

/**
 * Download experiment data in the specified format
 */
async function downloadExperimentData(
  client: PhoenixClient,
  experimentId: string,
  format: ExportFormat
): Promise<string> {
  const path =
    format === "csv"
      ? "/v1/experiments/{experiment_id}/csv"
      : "/v1/experiments/{experiment_id}/json";

  const response = await client.GET(path, {
    params: {
      path: {
        experiment_id: experimentId,
      },
    },
    parseAs: "text",
  });

  if (response.error || response.data === undefined) {
    throw new Error(
      `Failed to download experiment ${format.toUpperCase()}: ${response.error}`
    );
  }

  return response.data as string;
}

/**
 * Experiment export command handler
 */
async function experimentExportHandler(
  experimentId: string,
  options: ExperimentExportOptions
): Promise<void> {
  try {
    const format: ExportFormat = options.format || "json";

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
      message: `Exporting experiment ${experimentId} as ${format.toUpperCase()}...`,
      noProgress: !options.progress,
    });

    // Download experiment data in requested format
    const data = await downloadExperimentData(client, experimentId, format);

    writeProgress({
      message: `Downloaded experiment data`,
      noProgress: !options.progress,
    });

    if (options.output) {
      fs.writeFileSync(options.output, data, "utf-8");
      writeProgress({
        message: `Wrote experiment to ${options.output}`,
        noProgress: !options.progress,
      });
    } else {
      writeOutput({ message: data });
    }
  } catch (error) {
    writeError({
      message: `Error exporting experiment: ${error instanceof Error ? error.message : String(error)}`,
    });
    process.exit(1);
  }
}

/**
 * Create the experiment export subcommand
 */
export function createExperimentExportCommand(): Command {
  const command = new Command("export");

  command
    .description("Export experiment runs in CSV or JSON format")
    .argument("<experiment-id>", "Experiment identifier")
    .option("--endpoint <url>", "Phoenix API endpoint")
    .option("--api-key <key>", "Phoenix API key for authentication")
    .option(
      "--format <format>",
      "Export format: csv or json (default: json)",
      "json"
    )
    .option("--output <file>", "Write output to file instead of stdout")
    .option("--no-progress", "Disable progress indicators")
    .action(experimentExportHandler);

  return command;
}
