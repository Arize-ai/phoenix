import * as fs from "fs";
import * as path from "path";
import type { componentsV1, PhoenixClient } from "@arizeai/phoenix-client";
import { Command } from "commander";

import { createPhoenixClient, resolveDatasetId } from "../client";
import { getConfigErrorMessage, resolveConfig } from "../config";
import { ExitCode, getExitCodeForError } from "../exitCodes";
import { writeError, writeOutput, writeProgress } from "../io";
import {
  formatExperimentJsonOutput,
  type OutputFormat,
} from "./formatExperiment";
import {
  formatExperimentsOutput,
  type OutputFormat as ExperimentsOutputFormat,
} from "./formatExperiments";

type Experiment = componentsV1["schemas"]["Experiment"];

interface ExperimentGetOptions {
  endpoint?: string;
  apiKey?: string;
  format?: OutputFormat;
  progress?: boolean;
  file?: string;
}

interface ExperimentListOptions {
  endpoint?: string;
  apiKey?: string;
  dataset?: string;
  format?: ExperimentsOutputFormat;
  progress?: boolean;
  limit?: number;
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
    const response = await client.GET("/v1/datasets/{dataset_id}/experiments", {
      params: {
        path: {
          dataset_id: datasetId,
        },
        query: {
          cursor,
          limit: pageLimit,
        },
      },
    });

    if (response.error || !response.data) {
      throw new Error(`Failed to fetch experiments: ${response.error}`);
    }

    allExperiments.push(...response.data.data);
    cursor = response.data.next_cursor || undefined;

    if (options.limit && allExperiments.length >= options.limit) {
      break;
    }
  } while (cursor);

  return allExperiments;
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
 * Handler for `experiment get`
 */
async function experimentGetHandler(
  experimentId: string,
  options: ExperimentGetOptions
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
      process.exit(ExitCode.INVALID_ARGUMENT);
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
    process.exit(getExitCodeForError(error));
  }
}

/**
 * Handler for `experiment list`
 */
async function experimentListHandler(
  directory: string | undefined,
  options: ExperimentListOptions
): Promise<void> {
  try {
    const userSpecifiedFormat =
      process.argv.includes("--format") ||
      process.argv.some((arg) => arg.startsWith("--format="));

    const config = resolveConfig({
      cliOptions: {
        endpoint: options.endpoint,
        apiKey: options.apiKey,
      },
    });

    if (!config.endpoint) {
      const errors = [
        "Phoenix endpoint not configured. Set PHOENIX_HOST environment variable or use --endpoint flag.",
      ];
      writeError({ message: getConfigErrorMessage({ errors }) });
      process.exit(ExitCode.INVALID_ARGUMENT);
    }

    if (!options.dataset) {
      writeError({
        message:
          "Dataset not specified. Use --dataset <name-or-id> to specify a dataset.",
      });
      process.exit(ExitCode.INVALID_ARGUMENT);
    }

    const client = createPhoenixClient({ config });

    writeProgress({
      message: `Resolving dataset: ${options.dataset}`,
      noProgress: !options.progress,
    });

    const datasetId = await resolveDatasetId({
      client,
      datasetIdentifier: options.dataset,
    });

    writeProgress({
      message: `Fetching experiments for dataset ${datasetId}...`,
      noProgress: !options.progress,
    });

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

    if (directory) {
      if (userSpecifiedFormat && options.format && options.format !== "json") {
        writeError({
          message: `Warning: --format is ignored when writing experiments to a directory; writing JSON files to ${directory}`,
        });
      }

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
    process.exit(getExitCodeForError(error));
  }
}

export function createExperimentGetCommand(): Command {
  return new Command("get")
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
    .action(experimentGetHandler);
}

export function createExperimentListCommand(): Command {
  return new Command("list")
    .description("List experiments for a dataset")
    .argument(
      "[directory]",
      "Directory to write experiment files (optional, downloads full JSON data)"
    )
    .requiredOption("--dataset <name-or-id>", "Dataset name or ID (required)")
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
    .action(experimentListHandler);
}

/**
 * Create the `experiment` command with subcommands
 */
export function createExperimentCommand(): Command {
  const command = new Command("experiment");
  command.description("Manage Phoenix experiments");
  command.addCommand(createExperimentListCommand());
  command.addCommand(createExperimentGetCommand());
  return command;
}
