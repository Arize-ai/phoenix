import * as fs from "fs";
import type { componentsV1, PhoenixClient } from "@arizeai/phoenix-client";
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
import { collectString } from "../optionParsers";
import {
  type DatasetExamplesData,
  formatDatasetExamplesOutput,
  type OutputFormat,
} from "./formatDataset";
import { formatDatasetsOutput } from "./formatDatasets";
import type { CommonOptions, DeleteOptions } from "./options";

type Dataset = componentsV1["schemas"]["Dataset"];

/**
 * Options for `px dataset get <dataset-identifier>`. Without `--version`,
 * fetches examples from the latest version of the dataset.
 */
interface DatasetGetOptions extends CommonOptions<OutputFormat> {
  /**
   * `--file <path>`: Save output to file instead of stdout. When set, output
   * is always written as JSON regardless of `--format`.
   *
   * @example "./examples.json"
   */
  file?: string;
  /**
   * `--split <name>`: Filter examples by split name. Repeatable to include
   * multiple splits. Defaults to no filter (all splits).
   *
   * @example ["train"]
   */
  split?: string[];
  /**
   * `--version <id>`: Fetch examples from a specific dataset version instead
   * of the latest.
   *
   * @example "RGF0YXNldFZlcnNpb246MQ=="
   */
  version?: string;
}

/**
 * Options for `px dataset list`.
 */
interface DatasetListOptions extends CommonOptions<OutputFormat> {
  /**
   * `--limit <number>`: Maximum number of datasets to fetch. Defaults to 100.
   *
   * @example 50
   */
  limit?: number;
}

/**
 * Export formats accepted by `px dataset export`, each backed by a dedicated
 * server endpoint.
 */
const DATASET_EXPORT_FORMATS = [
  "csv",
  "jsonl",
  "openai-evals",
  "openai-ft",
] as const;

type DatasetExportFormat = (typeof DATASET_EXPORT_FORMATS)[number];

/**
 * Options for `px dataset export <dataset-identifier>`.
 */
interface DatasetExportOptions extends CommonOptions<DatasetExportFormat> {
  /**
   * `--output <path>`: Write the export to a file instead of stdout.
   *
   * @example "./dataset.jsonl"
   */
  output?: string;
  /**
   * `--version <id>`: Export a specific dataset version instead of the latest.
   *
   * @example "RGF0YXNldFZlcnNpb246MQ=="
   */
  version?: string;
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

    if (options.limit && allDatasets.length >= options.limit) {
      break;
    }
  } while (cursor);

  return allDatasets;
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
 * Validate and normalize the `--format` flag for `dataset export`.
 *
 * Defaults to `"jsonl"` when unset, lower-cases and trims the input, and throws
 * a clear error for anything outside the supported set so the handler can turn
 * it into an INVALID_ARGUMENT exit instead of a confusing downstream failure.
 */
function normalizeDatasetExportFormat(
  format: string | undefined
): DatasetExportFormat {
  const normalized = (format ?? "jsonl").trim().toLowerCase();
  if ((DATASET_EXPORT_FORMATS as readonly string[]).includes(normalized)) {
    return normalized as DatasetExportFormat;
  }
  throw new Error(
    `Invalid --format "${format}". Supported formats: ${DATASET_EXPORT_FORMATS.join(", ")}.`
  );
}

/**
 * Download a dataset's examples as text in the requested format.
 *
 * Each format maps to a dedicated endpoint; the typed `client.GET` calls are
 * kept per path so the generated OpenAPI types still narrow, and the response
 * validation is shared so the error handling lives in one place.
 */
async function downloadDataset(
  client: PhoenixClient,
  datasetId: string,
  format: DatasetExportFormat,
  versionId?: string
): Promise<string> {
  const path = { id: datasetId };
  const query = { version_id: versionId };
  let response;
  switch (format) {
    case "csv":
      response = await client.GET("/v1/datasets/{id}/csv", {
        params: { path, query },
        parseAs: "text",
      });
      break;
    case "openai-evals":
      response = await client.GET("/v1/datasets/{id}/jsonl/openai_evals", {
        params: { path, query },
        parseAs: "text",
      });
      break;
    case "openai-ft":
      response = await client.GET("/v1/datasets/{id}/jsonl/openai_ft", {
        params: { path, query },
        parseAs: "text",
      });
      break;
    case "jsonl":
    default:
      response = await client.GET("/v1/datasets/{id}/jsonl", {
        params: { path, query },
        parseAs: "text",
      });
      break;
  }

  if (response.error || response.data === undefined) {
    const detail =
      typeof response.error === "string"
        ? response.error
        : JSON.stringify(response.error);
    throw new Error(`Failed to export dataset: ${detail}`);
  }

  return response.data as string;
}

/**
 * Dataset command handler
 */
async function datasetHandler(
  datasetIdentifier: string,
  options: DatasetGetOptions
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
    process.exit(getExitCodeForError(error));
  }
}

/**
 * Handler for `dataset export`
 */
async function datasetExportHandler(
  datasetIdentifier: string,
  options: DatasetExportOptions
): Promise<void> {
  let format: DatasetExportFormat;
  try {
    format = normalizeDatasetExportFormat(options.format);
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
      message: `Resolving dataset: ${datasetIdentifier}`,
      noProgress: !options.progress,
    });

    const datasetId = await resolveDatasetId({ client, datasetIdentifier });

    writeProgress({
      message: `Exporting dataset ${datasetIdentifier} as ${format}...`,
      noProgress: !options.progress,
    });

    const data = await downloadDataset(
      client,
      datasetId,
      format,
      options.version
    );

    if (options.output) {
      fs.writeFileSync(options.output, data, "utf-8");
      writeProgress({
        message: `Wrote dataset ${datasetIdentifier} to ${options.output}`,
        noProgress: !options.progress,
      });
    } else {
      // Write the body exactly as the server returned it (no trailing newline
      // added) so `export --format csv > out.csv` matches `--output out.csv`.
      process.stdout.write(data);
    }
  } catch (error) {
    writeError({
      message: `Error exporting dataset: ${error instanceof Error ? error.message : String(error)}`,
    });
    process.exit(getExitCodeForError(error));
  }
}

/**
 * Handler for `dataset list`
 */
async function datasetListHandler(options: DatasetListOptions): Promise<void> {
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
      message: "Fetching datasets...",
      noProgress: !options.progress,
    });

    const datasets = await fetchDatasets(client, {
      limit: options.limit,
    });

    writeProgress({
      message: `Found ${datasets.length} dataset(s)`,
      noProgress: !options.progress,
    });

    const output = formatDatasetsOutput({
      datasets,
      format: options.format,
    });
    writeOutput({ message: output });
  } catch (error) {
    writeError({
      message: `Error fetching datasets: ${error instanceof Error ? error.message : String(error)}`,
    });
    process.exit(getExitCodeForError(error));
  }
}

/**
 * Handler for `dataset delete`
 */
async function datasetDeleteHandler(
  datasetIdentifier: string,
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

    writeProgress({
      message: `Resolving dataset: ${datasetIdentifier}`,
      noProgress: !options.progress,
    });

    const datasetId = await resolveDatasetId({ client, datasetIdentifier });

    await confirmOrExit({
      message: `Delete dataset ${datasetIdentifier}? This cannot be undone.`,
      yes: options.yes,
    });

    const response = await client.DELETE("/v1/datasets/{id}", {
      params: {
        path: {
          id: datasetId,
        },
      },
    });

    if (response.error) {
      throw new Error(`Failed to delete dataset: ${response.error}`);
    }

    writeProgress({
      message: `Deleted dataset ${datasetIdentifier}`,
      noProgress: !options.progress,
    });
  } catch (error) {
    writeError({
      message: `Error deleting dataset: ${error instanceof Error ? error.message : String(error)}`,
    });
    process.exit(getExitCodeForError(error));
  }
}

/**
 * Create the `dataset get` command
 */
export function createDatasetGetCommand(): Command {
  return new Command("get")
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
      collectString,
      []
    )
    .option(
      "--version <id>",
      "Fetch from a specific dataset version (discover IDs with px dataset-versions list)"
    )
    .action(datasetHandler);
}

export function createDatasetListCommand(): Command {
  return new Command("list")
    .description("List all available Phoenix datasets")
    .option("--endpoint <url>", "Phoenix API endpoint")
    .option("--api-key <key>", "Phoenix API key for authentication")
    .option(
      "--format <format>",
      "Output format: pretty, json, or raw",
      "pretty"
    )
    .option("--no-progress", "Disable progress indicators")
    .option("--limit <number>", "Maximum number of datasets to fetch", parseInt)
    .action(datasetListHandler);
}

/**
 * Create the `dataset export` command
 */
export function createDatasetExportCommand(): Command {
  return new Command("export")
    .description("Export a dataset's examples as CSV or JSONL")
    .argument("<dataset-identifier>", "Dataset name or ID")
    .option("--endpoint <url>", "Phoenix API endpoint")
    .option("--api-key <key>", "Phoenix API key for authentication")
    .option(
      "--format <format>",
      "Export format: csv, jsonl, openai-evals, or openai-ft",
      "jsonl"
    )
    .option("--output <path>", "Write export to a file instead of stdout")
    .option("--version <id>", "Export a specific dataset version")
    .option("--no-progress", "Disable progress indicators")
    .action(datasetExportHandler);
}

/**
 * Create the `dataset delete` command
 */
export function createDatasetDeleteCommand(): Command {
  return new Command("delete")
    .description("Delete a dataset")
    .argument("<dataset-identifier>", "Dataset name or ID")
    .option("--endpoint <url>", "Phoenix API endpoint")
    .option("--api-key <key>", "Phoenix API key for authentication")
    .option("-y, --yes", "Skip confirmation prompt")
    .option("--no-progress", "Disable progress indicators")
    .action(datasetDeleteHandler);
}

/**
 * Create the `dataset` command with subcommands
 */
export function createDatasetCommand(): Command {
  const command = new Command("dataset");
  command.description("Manage Phoenix datasets");
  command.addCommand(createDatasetListCommand());
  command.addCommand(createDatasetGetCommand());
  command.addCommand(createDatasetExportCommand());
  command.addCommand(createDatasetDeleteCommand());
  return command;
}
