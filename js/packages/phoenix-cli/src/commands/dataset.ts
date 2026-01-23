import type { PhoenixClient } from "@arizeai/phoenix-client";

import { createPhoenixClient, resolveDatasetId } from "../client";
import { getConfigErrorMessage, resolveConfig } from "../config";
import { writeError, writeOutput, writeProgress } from "../io";

import {
  type DatasetExamplesData,
  formatDatasetExamplesOutput,
  type OutputFormat,
} from "./formatDataset";

import { Command } from "commander";
import * as fs from "fs";

interface DatasetOptions {
  endpoint?: string;
  apiKey?: string;
  format?: OutputFormat;
  progress?: boolean;
  file?: string;
  split?: string[];
  version?: string;
}

/**
 * Fetch dataset examples from Phoenix
 */
async function fetchDatasetExamples(
  client: PhoenixClient,
  datasetId: string,
  options: {
    versionId?: string;
    splits?: string[];
  } = {}
): Promise<DatasetExamplesData> {
  const response = await client.GET("/v1/datasets/{id}/examples", {
    params: {
      path: {
        id: datasetId,
      },
      query: {
        version_id: options.versionId,
        split: options.splits,
      },
    },
  });

  if (response.error || !response.data) {
    throw new Error(`Failed to fetch dataset examples: ${response.error}`);
  }

  return response.data.data;
}

/**
 * Fetch dataset metadata for display name
 */
async function fetchDatasetName(
  client: PhoenixClient,
  datasetId: string
): Promise<string | undefined> {
  try {
    const response = await client.GET("/v1/datasets/{id}", {
      params: {
        path: {
          id: datasetId,
        },
      },
    });

    if (response.error || !response.data) {
      return undefined;
    }

    return response.data.data.name;
  } catch {
    return undefined;
  }
}

/**
 * Dataset command handler
 */
async function datasetHandler(
  datasetIdentifier: string,
  options: DatasetOptions
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
      message: `Resolving dataset: ${datasetIdentifier}`,
      noProgress: !options.progress,
    });

    // Resolve dataset ID
    const datasetId = await resolveDatasetId({
      client,
      datasetIdentifier,
    });

    // Fetch dataset name for display
    const datasetName = await fetchDatasetName(client, datasetId);

    writeProgress({
      message: `Fetching examples from dataset ${datasetName || datasetId}...`,
      noProgress: !options.progress,
    });

    // Fetch dataset examples
    const data = await fetchDatasetExamples(client, datasetId, {
      versionId: options.version,
      splits: options.split,
    });

    writeProgress({
      message: `Found ${data.examples.length} example(s)`,
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
    const output = formatDatasetExamplesOutput({
      data,
      datasetName,
      format: outputFormat,
    });

    if (options.file) {
      fs.writeFileSync(options.file, output, "utf-8");
      writeProgress({
        message: `Wrote dataset to ${options.file}`,
        noProgress: !options.progress,
      });
    } else {
      writeOutput({ message: output });
    }
  } catch (error) {
    writeError({
      message: `Error fetching dataset: ${error instanceof Error ? error.message : String(error)}`,
    });
    process.exit(1);
  }
}

/**
 * Collect multiple --split options into an array
 */
function collectSplits(value: string, previous: string[]): string[] {
  return previous.concat([value]);
}

/**
 * Create the dataset command
 */
export function createDatasetCommand(): Command {
  const command = new Command("dataset");

  command
    .description("Fetch examples from a dataset")
    .argument("<dataset-identifier>", "Dataset name or ID")
    .option("--endpoint <url>", "Phoenix API endpoint")
    .option("--api-key <key>", "Phoenix API key for authentication")
    .option(
      "--format <format>",
      "Output format: pretty, json, or raw",
      "pretty"
    )
    .option("--no-progress", "Disable progress indicators")
    .option("--file <path>", "Save output to file instead of stdout")
    .option(
      "--split <name>",
      "Filter by split name (can be used multiple times)",
      collectSplits,
      []
    )
    .option("--version <id>", "Fetch from a specific dataset version")
    .action(datasetHandler);

  return command;
}
