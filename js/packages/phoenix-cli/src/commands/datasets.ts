import type { componentsV1, PhoenixClient } from "@arizeai/phoenix-client";

import { createPhoenixClient } from "../client";
import { getConfigErrorMessage, resolveConfig } from "../config";
import { writeError, writeOutput, writeProgress } from "../io";

import { formatDatasetsOutput, type OutputFormat } from "./formatDatasets";

import { Command } from "commander";

type Dataset = componentsV1["schemas"]["Dataset"];

interface DatasetsOptions {
  endpoint?: string;
  apiKey?: string;
  format?: OutputFormat;
  progress?: boolean;
  limit?: number;
}

/**
 * Fetch all datasets from Phoenix
 */
async function fetchDatasets(
  client: PhoenixClient,
  options: { limit?: number } = {}
): Promise<Dataset[]> {
  const allDatasets: Dataset[] = [];
  let cursor: string | undefined;
  const pageLimit = options.limit || 100;

  do {
    const response = await client.GET("/v1/datasets", {
      params: {
        query: {
          cursor,
          limit: pageLimit,
        },
      },
    });

    if (response.error || !response.data) {
      throw new Error(`Failed to fetch datasets: ${response.error}`);
    }

    allDatasets.push(...response.data.data);
    cursor = response.data.next_cursor || undefined;

    // If we've fetched enough for the requested limit, stop
    if (options.limit && allDatasets.length >= options.limit) {
      break;
    }
  } while (cursor);

  return allDatasets;
}

/**
 * Datasets command handler
 */
async function datasetsHandler(options: DatasetsOptions): Promise<void> {
  try {
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
      message: "Fetching datasets...",
      noProgress: !options.progress,
    });

    // Fetch datasets
    const datasets = await fetchDatasets(client, {
      limit: options.limit,
    });

    writeProgress({
      message: `Found ${datasets.length} dataset(s)`,
      noProgress: !options.progress,
    });

    // Output datasets
    const output = formatDatasetsOutput({
      datasets,
      format: options.format,
    });
    writeOutput({ message: output });
  } catch (error) {
    writeError({
      message: `Error fetching datasets: ${error instanceof Error ? error.message : String(error)}`,
    });
    process.exit(1);
  }
}

/**
 * Create the datasets command
 */
export function createDatasetsCommand(): Command {
  const command = new Command("datasets");

  command
    .description("List all available Phoenix datasets")
    .option("--endpoint <url>", "Phoenix API endpoint")
    .option("--api-key <key>", "Phoenix API key for authentication")
    .option(
      "--format <format>",
      "Output format: pretty, json, or raw",
      "pretty"
    )
    .option("--no-progress", "Disable progress indicators")
    .option(
      "--limit <number>",
      "Maximum number of datasets to fetch",
      parseInt
    )
    .action(datasetsHandler);

  return command;
}
