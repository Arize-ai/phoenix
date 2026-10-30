import * as fs from "fs";
import * as path from "path";
import type { componentsV1, PhoenixClient } from "@arizeai/phoenix-client";
import { deleteExperiment } from "@arizeai/phoenix-client/experiments";
import { Command } from "commander";

import { createPhoenixClient, resolveDatasetId } from "../client";
import {
  getConfigErrorMessage,
  resolveConfig,
  validateConfig,
} from "../config";
import { assertDeletesEnabled, confirmOrExit } from "../confirm";
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
import type { CommonOptions, DeleteOptions } from "./options";

type Experiment = componentsV1["schemas"]["Experiment"];

/**
 * Options for `px experiment get <experiment-id>`.
 */
interface ExperimentGetOptions extends CommonOptions<OutputFormat> {
  /**
   * `--file <path>`: Save experiment to file instead of stdout. When set,
   * output is always written as JSON regardless of `--format`.
   *
   * @example "./experiment.json"
   */
  file?: string;
}

/**
 * Options for `px experiment list [directory]`.
 */
interface ExperimentListOptions extends CommonOptions<ExperimentsOutputFormat> {
  /**
   * `--dataset <name-or-id>`: Dataset name or ID whose experiments to list.
   * Required.
   *
   * @example "my-dataset"
   */
  dataset?: string;
  /**
   * `--limit <number>`: Maximum number of experiments to fetch. Defaults to
   * 100.
   *
   * @example 50
   */
  limit?: number;
}

/**
 * Options for `px experiment export <experiment-id>`.
 */
interface ExperimentExportOptions extends CommonOptions<"csv" | "json"> {
  /**
   * `--output <path>`: Write the export to a file instead of stdout.
   *
   * @example "./experiment.csv"
   */
  output?: string;
}

/**
 * Download an experiment's runs as text in the requested format.
 *
 * Keeps the two typed `client.GET` calls so the generated OpenAPI types still
 * narrow each path, but shares the response validation so the error handling
 * lives in one place.
 */
async function downloadExperiment(
  client: PhoenixClient,
  experimentId: string,
  format: "csv" | "json"
): Promise<string> {
  const response =
    format === "csv"
      ? await client.GET("/v1/experiments/{experiment_id}/csv", {
          params: { path: { experiment_id: experimentId } },
          parseAs: "text",
        })
      : await client.GET("/v1/experiments/{experiment_id}/json", {
          params: { path: { experiment_id: experimentId } },
          parseAs: "text",
        });

  if (response.error || response.data === undefined) {
    const detail =
      typeof response.error === "string"
        ? response.error
        : JSON.stringify(response.error);
    throw new Error(`Failed to download experiment: ${detail}`);
  }

  return response.data as string;
}

/**
 * Validate and normalize the `--format` flag for `experiment export`.
 *
 * Defaults to `"json"` when unset, lower-cases and trims the input, and throws
 * a clear error for anything other than `csv` or `json` so the handler can turn
 * it into an INVALID_ARGUMENT exit instead of a confusing downstream failure.
 */
function normalizeExperimentExportFormat(
  format: string | undefined
): "csv" | "json" {
  const normalized = (format ?? "json").trim().toLowerCase();
  if (normalized === "csv" || normalized === "json") {
    return normalized;
  }
  throw new Error(
    `Invalid --format "${format}". Supported formats: csv, json.`
  );
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

      const jsonData = await downloadExperiment(client, experiment.id, "json");

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
    const validation = validateConfig({ config, projectRequired: false });
    if (!validation.valid) {
      writeError({
        message: getConfigErrorMessage({ errors: validation.errors }),
      });
      process.exit(ExitCode.INVALID_ARGUMENT);
    }

    // Create client
    const client = createPhoenixClient({ config });

    writeProgress({
      message: `Fetching experiment ${experimentId}...`,
      noProgress: !options.progress,
    });

    // Download experiment JSON
    const jsonData = await downloadExperiment(client, experimentId, "json");

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
 * Handler for `experiment export`
 */
async function experimentExportHandler(
  experimentId: string,
  options: ExperimentExportOptions
): Promise<void> {
  let format: "csv" | "json";
  try {
    format = normalizeExperimentExportFormat(options.format);
  } catch (error) {
    writeError({
      message: error instanceof Error ? error.message : String(error),
    });
    process.exit(ExitCode.INVALID_ARGUMENT);
  }

  try {
    const config = resolveConfig({
      cliOptions: {
        endpoint: options.endpoint,
        apiKey: options.apiKey,
      },
    });

    const validation = validateConfig({ config, projectRequired: false });
    if (!validation.valid) {
      writeError({
        message: getConfigErrorMessage({ errors: validation.errors }),
      });
      process.exit(ExitCode.INVALID_ARGUMENT);
    }

    const client = createPhoenixClient({ config });

    writeProgress({
      message: `Exporting experiment ${experimentId} as ${format}...`,
      noProgress: !options.progress,
    });

    const data = await downloadExperiment(client, experimentId, format);

    if (options.output) {
      fs.writeFileSync(options.output, data, "utf-8");
      writeProgress({
        message: `Wrote experiment ${experimentId} to ${options.output}`,
        noProgress: !options.progress,
      });
    } else {
      writeOutput({ message: data });
    }
  } catch (error) {
    writeError({
      message: `Error exporting experiment: ${error instanceof Error ? error.message : String(error)}`,
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

    const validation = validateConfig({ config, projectRequired: false });
    if (!validation.valid) {
      writeError({
        message: getConfigErrorMessage({ errors: validation.errors }),
      });
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

export function createExperimentExportCommand(): Command {
  return new Command("export")
    .description("Export an experiment's runs as CSV or JSON")
    .argument("<experiment-id>", "Experiment identifier")
    .option("--endpoint <url>", "Phoenix API endpoint")
    .option("--api-key <key>", "Phoenix API key for authentication")
    .option("--format <format>", "Export format: csv or json", "json")
    .option("--output <path>", "Write export to a file instead of stdout")
    .option("--no-progress", "Disable progress indicators")
    .action(experimentExportHandler);
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
 * Handler for `experiment delete`
 */
async function experimentDeleteHandler(
  experimentId: string,
  options: DeleteOptions
): Promise<void> {
  try {
    assertDeletesEnabled();

    const config = resolveConfig({
      cliOptions: {
        endpoint: options.endpoint,
        apiKey: options.apiKey,
      },
    });

    const validation = validateConfig({ config, projectRequired: false });
    if (!validation.valid) {
      writeError({
        message: getConfigErrorMessage({ errors: validation.errors }),
      });
      process.exit(ExitCode.INVALID_ARGUMENT);
    }

    const client = createPhoenixClient({ config });

    await confirmOrExit({
      message: `Delete experiment ${experimentId}? This cannot be undone.`,
      yes: options.yes,
    });

    await deleteExperiment({ client, experimentId });

    writeProgress({
      message: `Deleted experiment ${experimentId}`,
      noProgress: !options.progress,
    });
  } catch (error) {
    writeError({
      message: `Error deleting experiment: ${error instanceof Error ? error.message : String(error)}`,
    });
    process.exit(getExitCodeForError(error));
  }
}

export function createExperimentDeleteCommand(): Command {
  return new Command("delete")
    .description("Delete an experiment by ID")
    .argument("<experiment-id>", "Experiment identifier")
    .option("--endpoint <url>", "Phoenix API endpoint")
    .option("--api-key <key>", "Phoenix API key for authentication")
    .option("-y, --yes", "Skip confirmation prompt")
    .option("--no-progress", "Disable progress indicators")
    .action(experimentDeleteHandler);
}

/**
 * Create the `experiment` command with subcommands
 */
export function createExperimentCommand(): Command {
  const command = new Command("experiment");
  command.description("Manage Phoenix experiments");
  command.addCommand(createExperimentListCommand());
  command.addCommand(createExperimentGetCommand());
  command.addCommand(createExperimentExportCommand());
  command.addCommand(createExperimentDeleteCommand());
  return command;
}
