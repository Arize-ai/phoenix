import type { componentsV1, PhoenixClient } from "@arizeai/phoenix-client";

import { createPhoenixClient, resolveDatasetId } from "../client";
import { getConfigErrorMessage, resolveConfig } from "../config";
import { writeError, writeOutput, writeProgress } from "../io";

import { formatExperimentsOutput, type OutputFormat } from "./formatExperiments";

import { Command } from "commander";
import * as fs from "fs";
import * as path from "path";

type Experiment = componentsV1["schemas"]["Experiment"];

interface ExperimentsOptions {
  endpoint?: string;
  apiKey?: string;
  dataset?: string;
  format?: OutputFormat;
  progress?: boolean;
  limit?: number;
}

/**
 * Fetch experiments for a dataset from Phoenix
 */
async function fetchExperiments(
  client: PhoenixClient,
  datasetId: string,
  options: { limit?: number } = {}
): Promise<Experiment[]> {
  const allExperiments: Experiment[] = [];
  let cursor: string | undefined;
  const pageLimit = options.limit || 100;

  do {
    const response = await client.GET(
      "/v1/datasets/{dataset_id}/experiments",
      {
        params: {
          path: {
            dataset_id: datasetId,
          },
          query: {
            cursor,
            limit: pageLimit,
          },
        },
      }
    );

    if (response.error || !response.data) {
      throw new Error(`Failed to fetch experiments: ${response.error}`);
    }

    allExperiments.push(...response.data.data);
    cursor = response.data.next_cursor || undefined;

    // If we've fetched enough for the requested limit, stop
    if (options.limit && allExperiments.length >= options.limit) {
      break;
    }
  } while (cursor);

  return allExperiments;
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
 * Write experiments to directory
 */
async function writeExperimentsToDirectory(
  client: PhoenixClient,
  experiments: Experiment[],
  directory: string,
  options: {
    noProgress?: boolean;
  } = {}
): Promise<void> {
  // Create directory if it doesn't exist
  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory, { recursive: true });
  }

  let completed = 0;

  for (const experiment of experiments) {
    try {
      writeProgress({
        message: `[${completed + 1}/${experiments.length}] Downloading experiment ${experiment.id}...`,
        noProgress: options.noProgress,
      });

      const jsonData = await downloadExperimentJson(client, experiment.id);

      const filename = `${experiment.id}.json`;
      const filepath = path.join(directory, filename);
      fs.writeFileSync(filepath, jsonData, "utf-8");

      completed++;
      writeProgress({
        message: `[${completed}/${experiments.length}] Wrote ${filename}`,
        noProgress: options.noProgress,
      });
    } catch (error) {
      writeProgress({
        message: `Warning: Failed to download experiment ${experiment.id}: ${error instanceof Error ? error.message : String(error)}`,
        noProgress: options.noProgress,
      });
    }
  }
}

/**
 * Experiments command handler
 */
async function experimentsHandler(
  directory: string | undefined,
  options: ExperimentsOptions
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

    // Validate that we have dataset
    if (!options.dataset) {
      writeError({
        message:
          "Dataset not specified. Use --dataset <name-or-id> to specify a dataset.",
      });
      process.exit(1);
    }

    // Create client
    const client = createPhoenixClient({ config });

    writeProgress({
      message: `Resolving dataset: ${options.dataset}`,
      noProgress: !options.progress,
    });

    // Resolve dataset ID
    const datasetId = await resolveDatasetId({
      client,
      datasetIdentifier: options.dataset,
    });

    writeProgress({
      message: `Fetching experiments for dataset ${datasetId}...`,
      noProgress: !options.progress,
    });

    // Fetch experiments
    const experiments = await fetchExperiments(client, datasetId, {
      limit: options.limit,
    });

    if (experiments.length === 0) {
      writeProgress({
        message: "No experiments found",
        noProgress: !options.progress,
      });
      return;
    }

    writeProgress({
      message: `Found ${experiments.length} experiment(s)`,
      noProgress: !options.progress,
    });

    // Output experiments
    if (directory) {
      if (userSpecifiedFormat && options.format && options.format !== "json") {
        writeError({
          message: `Warning: --format is ignored when writing experiments to a directory; writing JSON files to ${directory}`,
        });
      }

      // Write to directory
      writeProgress({
        message: `Writing experiments to ${directory}...`,
        noProgress: !options.progress,
      });

      await writeExperimentsToDirectory(client, experiments, directory, {
        noProgress: !options.progress,
      });

      writeProgress({
        message: `Done! Wrote ${experiments.length} experiment(s) to ${directory}`,
        noProgress: !options.progress,
      });
    } else {
      // Write to stdout
      const output = formatExperimentsOutput({
        experiments,
        format: options.format,
      });
      writeOutput({ message: output });
    }
  } catch (error) {
    writeError({
      message: `Error fetching experiments: ${error instanceof Error ? error.message : String(error)}`,
    });
    process.exit(1);
  }
}

/**
 * Create the experiments command
 */
export function createExperimentsCommand(): Command {
  const command = new Command("experiments");

  command
    .description("List experiments for a dataset")
    .argument(
      "[directory]",
      "Directory to write experiment files (optional, downloads full JSON data)"
    )
    .requiredOption(
      "--dataset <name-or-id>",
      "Dataset name or ID (required)"
    )
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
      "Maximum number of experiments to fetch",
      parseInt
    )
    .action(experimentsHandler);

  return command;
}
