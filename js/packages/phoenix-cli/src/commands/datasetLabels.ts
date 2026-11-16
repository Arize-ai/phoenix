import { HttpError } from "@arizeai/phoenix-client";
import {
  addLabelToDataset,
  listLabelsForDataset,
  removeLabelFromDataset,
  replaceLabelsForDataset,
} from "@arizeai/phoenix-client/datasets";
import { Command, Option } from "commander";

import { createPhoenixClient } from "../client";
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
import { collectString } from "../optionParsers";
import { writeStructuredError } from "../structuredError";
import { formatDatasetLabelsOutput } from "./formatDatasetLabels";
import type { CommonOptions } from "./options";

type DatasetLabelOperation = "list" | "add" | "remove" | "replace";

interface DatasetLabelsOptions extends CommonOptions {
  /** `--dataset <name-or-id>`: Dataset whose assignments are managed. */
  dataset?: string;
  /** `--label <id>`: Existing label ID; repeatable for replacement. */
  label?: string[];
  /** `--clear`: Explicitly replace all assignments with an empty set. */
  clear?: boolean;
}

function validateDatasetLabelsOptions({
  operation,
  options,
}: {
  operation: DatasetLabelOperation;
  options: DatasetLabelsOptions;
}): { datasetIdentifier: string; labelIds: string[]; labelId: string } {
  const datasetIdentifier = options.dataset;
  if (!datasetIdentifier?.trim()) {
    throw new InvalidArgumentError(
      "--dataset must be a non-empty dataset name or ID"
    );
  }
  const labelIds = options.label ?? [];
  if (labelIds.some((labelId) => !labelId.trim())) {
    throw new InvalidArgumentError("--label must be a non-empty label ID");
  }
  const labelId = labelIds[0] ?? "";
  if (
    (operation === "add" || operation === "remove") &&
    labelIds.length !== 1
  ) {
    throw new InvalidArgumentError("Exactly one --label is required");
  }
  if (operation === "replace") {
    if (options.clear && labelIds.length > 0) {
      throw new InvalidArgumentError("--clear cannot be combined with --label");
    }
    if (!options.clear && labelIds.length === 0) {
      throw new InvalidArgumentError(
        "Provide at least one --label, or --clear to remove all assignments"
      );
    }
  }
  return { datasetIdentifier, labelIds, labelId };
}

async function manageDatasetLabels({
  operation,
  options,
}: {
  operation: DatasetLabelOperation;
  options: DatasetLabelsOptions;
}): Promise<void> {
  try {
    const { datasetIdentifier, labelIds, labelId } =
      validateDatasetLabelsOptions({ operation, options });

    const config = resolveConfig({ cliOptions: options });
    const validation = validateConfig({ config, projectRequired: false });
    if (!validation.valid) {
      throw new InvalidArgumentError(
        getConfigErrorMessage({ errors: validation.errors })
      );
    }
    const client = createPhoenixClient({ config });
    const dataset = { datasetName: datasetIdentifier };
    writeProgress({
      message: `Managing label assignments for dataset "${datasetIdentifier}"...`,
      noProgress: !options.progress,
    });

    switch (operation) {
      case "list": {
        const labels = await listLabelsForDataset({ client, dataset });
        writeOutput({
          message: formatDatasetLabelsOutput({
            labels,
            format: options.format,
          }),
        });
        break;
      }
      case "add": {
        const label = await addLabelToDataset({
          client,
          dataset,
          labelId,
        });
        writeOutput({
          message: formatDatasetLabelsOutput({
            labels: label,
            format: options.format,
          }),
        });
        break;
      }
      case "remove": {
        await removeLabelFromDataset({ client, dataset, labelId });
        const result = {
          dataset_identifier: datasetIdentifier,
          label_id: labelId,
        };
        writeOutput({
          message:
            options.format === "raw" || options.format === "json"
              ? JSON.stringify(
                  result,
                  null,
                  options.format === "json" ? 2 : undefined
                )
              : `Removed label assignment ${labelId} from dataset "${datasetIdentifier}"`,
        });
        break;
      }
      case "replace": {
        const labels = await replaceLabelsForDataset({
          client,
          dataset,
          labelIds,
        });
        writeOutput({
          message: formatDatasetLabelsOutput({
            labels,
            format: options.format,
          }),
        });
        break;
      }
    }
  } catch (error) {
    const exitCode =
      error instanceof HttpError &&
      (error.status === 401 || error.status === 403)
        ? ExitCode.AUTH_REQUIRED
        : error instanceof HttpError && error.status === 422
          ? ExitCode.INVALID_ARGUMENT
          : getExitCodeForError(error);
    const message =
      error instanceof HttpError
        ? `Phoenix returned HTTP ${error.status}`
        : error instanceof Error
          ? error.message
          : String(error);
    writeStructuredError({
      format: options.format,
      message: `Error managing dataset labels: ${message}`,
      code:
        Object.entries(ExitCode).find(([, value]) => value === exitCode)?.[0] ??
        "FAILURE",
      hint: `px dataset-labels ${operation} --help`,
    });
    process.exit(exitCode);
  }
}

/** Create commands that manage dataset membership in existing global labels. */
export function createDatasetLabelsCommand(): Command {
  const command = new Command("dataset-labels").description(
    "Manage dataset label assignments without changing global labels (Phoenix >= 17.16.0)"
  );
  const operations = [
    ["list", "List the labels assigned to a dataset"],
    ["add", "Apply an existing label to a dataset (idempotent)"],
    [
      "remove",
      "Remove an assignment without deleting the global label (idempotent)",
    ],
    ["replace", "Replace all label assignments without deleting global labels"],
  ] as const;
  for (const [operation, description] of operations) {
    const subcommand = command
      .command(operation)
      .description(description)
      .option("--dataset <name-or-id>", "Dataset name or GlobalID (required)")
      .option("--endpoint <url>", "Phoenix API endpoint")
      .option("--api-key <key>", "Phoenix API key for authentication")
      .addOption(
        new Option("--format <format>", "Output format")
          .choices(["pretty", "json", "raw"])
          .default("pretty")
      )
      .option("--no-progress", "Disable progress indicators");
    if (operation !== "list") {
      subcommand.option(
        "--label <id>",
        operation === "replace"
          ? "Label GlobalID to keep assigned (repeatable)"
          : "Label GlobalID (exactly one required)",
        collectString,
        []
      );
    }
    if (operation === "replace") {
      subcommand.option(
        "--clear",
        "Remove all assignments; cannot be combined with --label"
      );
    }
    const example =
      operation === "list"
        ? "px dataset-labels list --dataset my-dataset --format raw --no-progress"
        : `px dataset-labels ${operation} --dataset my-dataset --label RGF0YXNldExhYmVsOjE=`;
    subcommand
      .addHelpText(
        "after",
        `\nExamples:\n  ${example}${
          operation === "replace"
            ? "\n  px dataset-labels replace --dataset my-dataset --clear"
            : ""
        }`
      )
      .action((options: DatasetLabelsOptions) =>
        manageDatasetLabels({ operation, options })
      );
  }
  return command;
}
