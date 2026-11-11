import type { PhoenixClient } from "@arizeai/phoenix-client";
import { Command, Option } from "commander";

import { createPhoenixClient, resolveDatasetId } from "../client";
import {
  getConfigErrorMessage,
  resolveConfig,
  validateConfig,
} from "../config";
import {
  ExitCode,
  getExitCodeForError,
  InvalidArgumentError,
} from "../exitCodes";
import { writeOutput, writeProgress } from "../io";
import { writeStructuredError } from "../structuredError";
import {
  type DatasetVersion,
  formatDatasetVersionsOutput,
} from "./formatDatasetVersions";
import type { CommonOptions } from "./options";

interface DatasetVersionsListOptions extends CommonOptions {
  /**
   * `--limit <number>`: Maximum number of versions to fetch. By default,
   * fetches all versions in pages of 100.
   *
   * @example 10
   */
  limit?: number;
}

async function fetchDatasetVersions({
  client,
  datasetId,
  limit,
}: {
  client: PhoenixClient;
  datasetId: string;
  limit?: number;
}): Promise<DatasetVersion[]> {
  const datasetVersions: DatasetVersion[] = [];
  let cursor: string | undefined;

  do {
    const pageLimit =
      limit === undefined ? 100 : limit - datasetVersions.length;
    const response = await client.GET("/v1/datasets/{id}/versions", {
      params: {
        path: { id: datasetId },
        query: { cursor, limit: pageLimit },
      },
    });

    if (response.error || !response.data) {
      throw new Error(
        `Failed to fetch dataset versions: ${JSON.stringify(response.error)}`
      );
    }

    datasetVersions.push(...response.data.data.slice(0, pageLimit));
    cursor = response.data.next_cursor || undefined;
  } while (cursor && (limit === undefined || datasetVersions.length < limit));

  return datasetVersions;
}

async function datasetVersionsListHandler({
  datasetIdentifier,
  options,
}: {
  datasetIdentifier: string;
  options: DatasetVersionsListOptions;
}): Promise<void> {
  let hint: string | undefined;
  try {
    if (
      options.limit !== undefined &&
      (!Number.isSafeInteger(options.limit) || options.limit <= 0)
    ) {
      hint = "px dataset-versions list <dataset-identifier> --limit <number>";
      throw new InvalidArgumentError("--limit must be a positive integer");
    }
    const config = resolveConfig({ cliOptions: options });
    const validation = validateConfig({ config, projectRequired: false });
    if (!validation.valid) {
      throw new InvalidArgumentError(
        getConfigErrorMessage({ errors: validation.errors })
      );
    }
    const client = createPhoenixClient({ config });
    writeProgress({
      message: `Resolving dataset: ${datasetIdentifier}`,
      noProgress: !options.progress,
    });

    hint = "px dataset list";
    const datasetId = await resolveDatasetId({ client, datasetIdentifier });
    hint = undefined;

    writeProgress({
      message: `Fetching versions of dataset "${datasetIdentifier}"...`,
      noProgress: !options.progress,
    });

    // Unlike prompts, a dataset can exist with no versions, so an empty list is not an error.
    const datasetVersions = await fetchDatasetVersions({
      client,
      datasetId,
      limit: options.limit,
    });

    writeProgress({
      message: `Found ${datasetVersions.length} dataset version(s)`,
      noProgress: !options.progress,
    });
    writeOutput({
      message: formatDatasetVersionsOutput({
        datasetVersions,
        format: options.format,
      }),
    });
  } catch (error) {
    const exitCode = getExitCodeForError(error);
    writeStructuredError({
      format: options.format,
      message: `Error fetching dataset versions: ${error instanceof Error ? error.message : String(error)}`,
      code:
        Object.entries(ExitCode).find(([, value]) => value === exitCode)?.[0] ??
        "FAILURE",
      hint,
    });
    process.exit(exitCode);
  }
}

export function createDatasetVersionsCommand(): Command {
  const command = new Command("dataset-versions").description(
    "Manage Phoenix dataset versions"
  );
  command
    .command("list")
    .description("List versions of a Phoenix dataset")
    .argument("<dataset-identifier>", "Dataset name or ID")
    .option("--endpoint <url>", "Phoenix API endpoint")
    .option("--api-key <key>", "Phoenix API key for authentication")
    .addOption(
      new Option("--format <format>", "Output format")
        .choices(["pretty", "json", "raw"])
        .default("pretty")
    )
    .option("--no-progress", "Disable progress indicators")
    .option("--limit <number>", "Maximum number of versions to fetch", Number)
    .addHelpText(
      "after",
      `
Examples:
  px dataset-versions list my-dataset
  px dataset-versions list my-dataset --limit 10 --format json
  px dataset-versions list my-dataset --format raw --no-progress`
    )
    .action((datasetIdentifier: string, options: DatasetVersionsListOptions) =>
      datasetVersionsListHandler({ datasetIdentifier, options })
    );
  return command;
}
