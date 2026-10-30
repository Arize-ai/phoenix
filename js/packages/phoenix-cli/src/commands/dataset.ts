import * as fs from "fs";
import {
  type componentsV1,
  HttpError,
  type PhoenixClient,
} from "@arizeai/phoenix-client";
import {
  createDatasetSplit,
  deleteDatasetSplit,
  updateDatasetSplit,
} from "@arizeai/phoenix-client/datasets";
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
import { writeStructuredError } from "../structuredError";
import {
  type DatasetExamplesData,
  formatDatasetExamplesOutput,
  type OutputFormat,
} from "./formatDataset";
import { formatDatasetsOutput } from "./formatDatasets";
import {
  formatDatasetSplitDeleteOutput,
  formatDatasetSplitOutput,
} from "./formatDatasetSplit";
import type {
  CommonOptions,
  ConfirmationOptions,
  DeleteOptions,
} from "./options";

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
    .option("--version <id>", "Fetch from a specific dataset version")
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
 * Options for `px dataset split create <dataset-identifier>`.
 */
interface DatasetSplitCreateOptions extends CommonOptions<OutputFormat> {
  /**
   * `--name <name>`: Unique name for the split. Required.
   *
   * @example "train"
   */
  name?: string;
  /**
   * `--description <text>`: Optional description of the split.
   *
   * @example "Examples used for prompt tuning"
   */
  description?: string;
  /**
   * `--metadata <json>`: Split metadata as a JSON object string.
   *
   * @example '{"owner":"evals"}'
   */
  metadata?: string;
  /**
   * `--example-id <id>`: Example to seed the split with, by GlobalID or
   * user-provided ID. Repeatable; defaults to no examples.
   *
   * @example ["RGF0YXNldEV4YW1wbGU6MQ=="]
   */
  exampleId?: string[];
}

/**
 * Options for `px dataset split update <dataset-identifier> <split-id>`.
 * Only the flags that are passed are sent; at least one is required.
 */
interface DatasetSplitUpdateOptions extends CommonOptions<OutputFormat> {
  /**
   * `--name <name>`: New unique name for the split.
   *
   * @example "train-v2"
   */
  name?: string;
  /**
   * `--description <text>`: New description. An empty string clears it.
   *
   * @example "Refreshed for round 2"
   */
  description?: string;
  /**
   * `--metadata <json>`: JSON object that replaces the split's metadata.
   *
   * @example '{"owner":"evals","round":2}'
   */
  metadata?: string;
  /**
   * `--add-example <id>`: Example to add, by GlobalID or user-provided ID.
   * Repeatable.
   *
   * @example ["RGF0YXNldEV4YW1wbGU6MQ=="]
   */
  addExample?: string[];
  /**
   * `--remove-example <id>`: Example to remove, by GlobalID or user-provided
   * ID. Repeatable. Removal wins when an ID is also added.
   *
   * @example ["user-example-3"]
   */
  removeExample?: string[];
}

/**
 * Options for `px dataset split delete <dataset-identifier> <split-id>`.
 */
interface DatasetSplitDeleteOptions
  extends CommonOptions<OutputFormat>, ConfirmationOptions {}

const DATASET_SPLIT_LIST_HELP =
  "\nThe CLI cannot list a dataset's splits yet; see\n" +
  "https://github.com/Arize-ai/phoenix/issues/12090.\n";

/**
 * Parse `--metadata` as a JSON object, exiting `INVALID_ARGUMENT` for invalid
 * JSON or any other JSON value (array, string, number, or null).
 */
function parseSplitMetadataOrExit({
  metadata,
  format,
}: {
  metadata: string | undefined;
  format?: OutputFormat;
}): Record<string, unknown> | undefined {
  if (metadata === undefined) {
    return undefined;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(metadata);
  } catch {
    parsed = undefined;
  }
  if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
    return parsed as Record<string, unknown>;
  }
  writeStructuredError({
    format,
    message: `--metadata must be a JSON object, got: ${metadata}`,
    code: "INVALID_ARGUMENT",
    hint: `--metadata '{"owner":"evals"}'`,
  });
  return process.exit(ExitCode.INVALID_ARGUMENT);
}

/**
 * Map a failed split request to a `StructuredError` and exit code. The server
 * answers 404 for an unknown dataset, split, or example, 409 for a duplicate
 * split name, and 422 for an empty name or a malformed split GlobalID, with
 * the reason as a plain-text body.
 */
async function exitOnDatasetSplitHttpError({
  error,
  action,
  format,
}: {
  error: HttpError;
  action: string;
  format?: OutputFormat;
}): Promise<never> {
  const detail = (await error.response.text().catch(() => "")) || error.message;
  const message = `Error ${action} dataset split: ${detail}`;
  if (error.status === 401 || error.status === 403) {
    writeStructuredError({
      format,
      message,
      code: "AUTH_REQUIRED",
      hint: "px auth status",
    });
    process.exit(ExitCode.AUTH_REQUIRED);
  }
  if (error.status === 400 || error.status === 422) {
    writeStructuredError({ format, message, code: "INVALID_ARGUMENT" });
    process.exit(ExitCode.INVALID_ARGUMENT);
  }
  writeStructuredError({ format, message, code: "FAILURE" });
  process.exit(ExitCode.FAILURE);
}

/**
 * Resolve and validate the connection config shared by the split handlers.
 */
function createDatasetSplitClient(options: CommonOptions<OutputFormat>) {
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

  return createPhoenixClient({ config });
}

/**
 * Report a failed split request and exit with the matching code.
 */
async function exitOnDatasetSplitError({
  error,
  action,
  format,
}: {
  error: unknown;
  action: string;
  format?: OutputFormat;
}): Promise<never> {
  if (error instanceof HttpError) {
    await exitOnDatasetSplitHttpError({ error, action, format });
  }
  writeError({
    message: `Error ${action} dataset split: ${error instanceof Error ? error.message : String(error)}`,
  });
  process.exit(getExitCodeForError(error));
}

/**
 * Handler for `dataset split create`
 */
async function datasetSplitCreateHandler(
  datasetIdentifier: string,
  options: DatasetSplitCreateOptions
): Promise<void> {
  // Argument-shape validation runs before the try block so its `process.exit`
  // isn't caught and re-mapped by the catch-all error handler below.
  if (!options.name) {
    writeStructuredError({
      format: options.format,
      message: "Missing required flag --name",
      code: "INVALID_ARGUMENT",
      hint: `px dataset split create ${datasetIdentifier} --name <name>`,
    });
    process.exit(ExitCode.INVALID_ARGUMENT);
  }
  const metadata = parseSplitMetadataOrExit({
    metadata: options.metadata,
    format: options.format,
  });
  const exampleIds = options.exampleId ?? [];

  try {
    const client = createDatasetSplitClient(options);

    writeProgress({
      message: `Creating split ${options.name} on dataset ${datasetIdentifier}...`,
      noProgress: !options.progress,
    });

    // The split routes resolve the dataset by GlobalID or name on the server,
    // so the identifier is passed through without a lookup.
    const split = await createDatasetSplit({
      client,
      dataset: { datasetName: datasetIdentifier },
      name: options.name,
      description: options.description,
      metadata,
      exampleIds: exampleIds.length > 0 ? exampleIds : undefined,
    });

    writeOutput({
      message: formatDatasetSplitOutput({ split, format: options.format }),
    });
  } catch (error) {
    await exitOnDatasetSplitError({
      error,
      action: "creating",
      format: options.format,
    });
  }
}

/**
 * Handler for `dataset split update`
 */
async function datasetSplitUpdateHandler(
  datasetIdentifier: string,
  splitId: string,
  options: DatasetSplitUpdateOptions
): Promise<void> {
  // Argument-shape validation runs before the try block so its `process.exit`
  // isn't caught and re-mapped by the catch-all error handler below.
  const addExampleIds = options.addExample ?? [];
  const removeExampleIds = options.removeExample ?? [];
  const hasUpdate =
    options.name !== undefined ||
    options.description !== undefined ||
    options.metadata !== undefined ||
    addExampleIds.length > 0 ||
    removeExampleIds.length > 0;
  if (!hasUpdate) {
    writeStructuredError({
      format: options.format,
      message: "No fields to update were provided",
      code: "INVALID_ARGUMENT",
      hint: `px dataset split update ${datasetIdentifier} ${splitId} --add-example <example-id>`,
    });
    process.exit(ExitCode.INVALID_ARGUMENT);
  }
  const metadata = parseSplitMetadataOrExit({
    metadata: options.metadata,
    format: options.format,
  });

  try {
    const client = createDatasetSplitClient(options);

    writeProgress({
      message: `Updating split ${splitId} on dataset ${datasetIdentifier}...`,
      noProgress: !options.progress,
    });

    const split = await updateDatasetSplit({
      client,
      dataset: { datasetName: datasetIdentifier },
      splitId,
      name: options.name,
      description: options.description,
      metadata,
      addExampleIds: addExampleIds.length > 0 ? addExampleIds : undefined,
      removeExampleIds:
        removeExampleIds.length > 0 ? removeExampleIds : undefined,
    });

    writeOutput({
      message: formatDatasetSplitOutput({ split, format: options.format }),
    });
  } catch (error) {
    await exitOnDatasetSplitError({
      error,
      action: "updating",
      format: options.format,
    });
  }
}

/**
 * Handler for `dataset split delete`
 */
async function datasetSplitDeleteHandler(
  datasetIdentifier: string,
  splitId: string,
  options: DatasetSplitDeleteOptions
): Promise<void> {
  try {
    assertDeletesEnabled();

    const client = createDatasetSplitClient(options);

    await confirmOrExit({
      message: `Delete dataset split ${splitId}? The split is removed from every dataset that uses it; its examples are not deleted. This cannot be undone.`,
      yes: options.yes,
    });

    writeProgress({
      message: `Deleting split ${splitId} on dataset ${datasetIdentifier}...`,
      noProgress: !options.progress,
    });

    await deleteDatasetSplit({
      client,
      dataset: { datasetName: datasetIdentifier },
      splitId,
    });

    writeOutput({
      message: formatDatasetSplitDeleteOutput({
        result: {
          deleted: true,
          dataset: datasetIdentifier,
          split_id: splitId,
        },
        format: options.format,
      }),
    });
  } catch (error) {
    await exitOnDatasetSplitError({
      error,
      action: "deleting",
      format: options.format,
    });
  }
}

function addDatasetSplitCommonOptions(command: Command): Command {
  return command
    .option("--endpoint <url>", "Phoenix API endpoint")
    .option("--api-key <key>", "Phoenix API key for authentication")
    .option(
      "--format <format>",
      "Output format: pretty, json, or raw",
      "pretty"
    )
    .option("--no-progress", "Disable progress indicators");
}

export function createDatasetSplitCreateCommand(): Command {
  return addDatasetSplitCommonOptions(
    new Command("create")
      .description("Create a split on a dataset")
      .argument("<dataset-identifier>", "Dataset name or ID")
      .option("--name <name>", "Unique split name (required)")
      .option("--description <text>", "Split description")
      .option("--metadata <json>", "Split metadata as a JSON object")
      .option(
        "--example-id <id>",
        "Example GlobalID or user-provided ID to add (can be used multiple times)",
        collectString,
        []
      )
  )
    .addHelpText(
      "after",
      "\nExamples:\n" +
        "  px dataset split create qa-golden --name train\n" +
        "  px dataset split create qa-golden --name holdout --description 'Held-out examples' --metadata '{\"owner\":\"evals\"}'\n" +
        "  px dataset split create qa-golden --name smoke --example-id <example-id> --example-id <example-id>\n\n" +
        "  # Capture the new split ID (agent-friendly)\n" +
        "  px dataset split create qa-golden --name train --format raw --no-progress | jq -r '.id'\n"
    )
    .action(datasetSplitCreateHandler);
}

export function createDatasetSplitUpdateCommand(): Command {
  return addDatasetSplitCommonOptions(
    new Command("update")
      .description(
        "Update a dataset split's name, description, metadata, or examples"
      )
      .argument("<dataset-identifier>", "Dataset name or ID")
      .argument("<split-id>", "Dataset split ID (GlobalID)")
      .option("--name <name>", "New unique split name")
      .option("--description <text>", "New description (pass '' to clear it)")
      .option(
        "--metadata <json>",
        "JSON object that replaces the split's metadata"
      )
      .option(
        "--add-example <id>",
        "Example GlobalID or user-provided ID to add (can be used multiple times)",
        collectString,
        []
      )
      .option(
        "--remove-example <id>",
        "Example GlobalID or user-provided ID to remove (can be used multiple times)",
        collectString,
        []
      )
  )
    .addHelpText(
      "after",
      "\nExamples:\n" +
        "  px dataset split update qa-golden RGF0YXNldFNwbGl0OjE= --name train-v2\n" +
        "  px dataset split update qa-golden RGF0YXNldFNwbGl0OjE= --add-example <example-id> --remove-example <example-id>\n" +
        "  px dataset split update qa-golden RGF0YXNldFNwbGl0OjE= --metadata '{\"round\":2}' --format raw --no-progress\n"
    )
    .action(datasetSplitUpdateHandler);
}

export function createDatasetSplitDeleteCommand(): Command {
  return addDatasetSplitCommonOptions(
    new Command("delete")
      .description("Delete a dataset split without deleting its examples")
      .argument("<dataset-identifier>", "Dataset name or ID")
      .argument("<split-id>", "Dataset split ID (GlobalID)")
      .option("-y, --yes", "Skip confirmation prompt")
  )
    .addHelpText(
      "after",
      "\nExamples:\n" +
        "  px dataset split delete qa-golden RGF0YXNldFNwbGl0OjE=\n" +
        "  px dataset split delete qa-golden RGF0YXNldFNwbGl0OjE= --yes --format raw\n"
    )
    .action(datasetSplitDeleteHandler);
}

/**
 * Create the `dataset split` command with `create`, `update`, and `delete`
 * subcommands.
 */
export function createDatasetSplitCommand(): Command {
  const command = new Command("split");
  command.description("Create, update, or delete dataset splits");
  command.addCommand(createDatasetSplitCreateCommand());
  command.addCommand(createDatasetSplitUpdateCommand());
  command.addCommand(createDatasetSplitDeleteCommand());
  command.addHelpText("after", DATASET_SPLIT_LIST_HELP);
  return command;
}

/**
 * Create the `dataset` command with subcommands
 */
export function createDatasetCommand(): Command {
  const command = new Command("dataset");
  command.description("Manage Phoenix datasets");
  command.addCommand(createDatasetListCommand());
  command.addCommand(createDatasetGetCommand());
  command.addCommand(createDatasetDeleteCommand());
  command.addCommand(createDatasetSplitCommand());
  return command;
}
