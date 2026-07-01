import type { componentsV1, PhoenixClient } from "@arizeai/phoenix-client";
import { Command } from "commander";

import { createPhoenixClient } from "../client";
import {
  getConfigErrorMessage,
  resolveConfig,
  validateConfig,
} from "../config";
import { assertDeletesEnabled, confirmOrExit } from "../confirm";
import { ExitCode, getExitCodeForError } from "../exitCodes";
import { writeError, writeOutput, writeProgress } from "../io";
import { writeStructuredError } from "../structuredError";
import {
  formatAnnotationConfigOutput,
  formatAnnotationConfigsOutput,
  type OutputFormat,
} from "./formatAnnotationConfigs";

type AnnotationConfig =
  | componentsV1["schemas"]["CategoricalAnnotationConfig"]
  | componentsV1["schemas"]["ContinuousAnnotationConfig"]
  | componentsV1["schemas"]["FreeformAnnotationConfig"];

type CategoricalAnnotationValue =
  componentsV1["schemas"]["CategoricalAnnotationValue"];

type CreateAnnotationConfigData =
  componentsV1["schemas"]["CreateAnnotationConfigData"];

type OptimizationDirection = componentsV1["schemas"]["OptimizationDirection"];

const OPTIMIZATION_DIRECTIONS: readonly OptimizationDirection[] = [
  "MINIMIZE",
  "MAXIMIZE",
  "NONE",
];

interface AnnotationConfigListOptions {
  endpoint?: string;
  apiKey?: string;
  format?: OutputFormat;
  progress?: boolean;
  limit?: number;
}

interface AnnotationConfigDeleteOptions {
  endpoint?: string;
  apiKey?: string;
  yes?: boolean;
  progress?: boolean;
}

interface AnnotationConfigUpdateOptions {
  endpoint?: string;
  apiKey?: string;
  format?: OutputFormat;
  progress?: boolean;
  name?: string;
  description?: string;
  optimizationDirection?: string;
  lowerBound?: number;
  upperBound?: number;
  threshold?: number;
  values?: string;
}

/**
 * Parse the `--values` JSON payload into categorical annotation values.
 *
 * Accepts a JSON array of objects shaped like `{ "label": string, "score"?:
 * number }`. Throws a descriptive error on malformed input so the caller can
 * surface an actionable message.
 */
function parseCategoricalValues(raw: string): CategoricalAnnotationValue[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(
      "--values must be a valid JSON array, e.g. " +
        '\'[{"label":"good","score":1},{"label":"bad","score":0}]\''
    );
  }
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error("--values must be a non-empty JSON array of label objects");
  }
  return parsed.map((entry) => {
    if (
      typeof entry !== "object" ||
      entry === null ||
      typeof (entry as { label?: unknown }).label !== "string"
    ) {
      throw new Error(
        'Each --values entry must be an object with a string "label" field'
      );
    }
    const { label, score } = entry as { label: string; score?: unknown };
    if (score !== undefined && score !== null && typeof score !== "number") {
      throw new Error('--values "score" must be a number when provided');
    }
    return {
      label,
      ...(score !== undefined && score !== null ? { score } : {}),
    };
  });
}

/**
 * Merge the provided update options onto an existing annotation config to
 * produce the full replacement body required by `PUT
 * /v1/annotation_configs/{id}`. Only fields the caller supplied are changed;
 * everything else is carried over from `existing`. The config `type` is
 * immutable — to change it, delete and recreate the config.
 *
 * Type-specific flags are validated against the existing config's type so a
 * mismatch (e.g. `--values` on a continuous config) fails loudly instead of
 * being silently ignored.
 */
function buildUpdatedConfigData(
  existing: AnnotationConfig,
  options: AnnotationConfigUpdateOptions
): CreateAnnotationConfigData {
  const name = options.name ?? existing.name;
  const description =
    options.description !== undefined
      ? options.description
      : existing.description;
  const optimizationDirection =
    (options.optimizationDirection as OptimizationDirection | undefined) ??
    existing.optimization_direction;

  if (existing.type === "CATEGORICAL") {
    if (options.lowerBound !== undefined || options.upperBound !== undefined) {
      throw new Error(
        "--lower-bound and --upper-bound are not valid for CATEGORICAL configs"
      );
    }
    if (options.threshold !== undefined) {
      throw new Error("--threshold is not valid for CATEGORICAL configs");
    }
    return {
      type: "CATEGORICAL",
      name,
      description,
      optimization_direction:
        optimizationDirection ?? existing.optimization_direction,
      values:
        options.values !== undefined
          ? parseCategoricalValues(options.values)
          : existing.values,
    };
  }

  if (existing.type === "CONTINUOUS") {
    if (options.values !== undefined) {
      throw new Error("--values is only valid for CATEGORICAL configs");
    }
    if (options.threshold !== undefined) {
      throw new Error("--threshold is not valid for CONTINUOUS configs");
    }
    return {
      type: "CONTINUOUS",
      name,
      description,
      optimization_direction:
        optimizationDirection ?? existing.optimization_direction,
      lower_bound:
        options.lowerBound !== undefined
          ? options.lowerBound
          : existing.lower_bound,
      upper_bound:
        options.upperBound !== undefined
          ? options.upperBound
          : existing.upper_bound,
    };
  }

  // FREEFORM
  if (options.values !== undefined) {
    throw new Error("--values is only valid for CATEGORICAL configs");
  }
  return {
    type: "FREEFORM",
    name,
    description,
    optimization_direction: optimizationDirection,
    threshold:
      options.threshold !== undefined ? options.threshold : existing.threshold,
    lower_bound:
      options.lowerBound !== undefined
        ? options.lowerBound
        : existing.lower_bound,
    upper_bound:
      options.upperBound !== undefined
        ? options.upperBound
        : existing.upper_bound,
  };
}

/**
 * Fetch all annotation configs from Phoenix
 */
async function fetchAnnotationConfigs(
  client: PhoenixClient,
  options: { limit?: number } = {}
): Promise<AnnotationConfig[]> {
  const allConfigs: AnnotationConfig[] = [];
  let cursor: string | undefined;
  const pageLimit = options.limit || 100;

  do {
    const response = await client.GET("/v1/annotation_configs", {
      params: {
        query: {
          cursor,
          limit: pageLimit,
        },
      },
    });

    if (response.error || !response.data) {
      throw new Error(`Failed to fetch annotation configs: ${response.error}`);
    }

    allConfigs.push(...response.data.data);
    cursor = response.data.next_cursor || undefined;

    // If we've fetched enough for the requested limit, stop
    if (options.limit && allConfigs.length >= options.limit) {
      break;
    }
  } while (cursor);

  return allConfigs;
}

/**
 * Handler for `annotation-config list`
 */
async function annotationConfigListHandler(
  options: AnnotationConfigListOptions
): Promise<void> {
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
      message: "Fetching annotation configs...",
      noProgress: !options.progress,
    });

    const configs = await fetchAnnotationConfigs(client, {
      limit: options.limit,
    });

    writeProgress({
      message: `Found ${configs.length} annotation config(s)`,
      noProgress: !options.progress,
    });

    const output = formatAnnotationConfigsOutput({
      configs,
      format: options.format,
    });
    writeOutput({ message: output });
  } catch (error) {
    writeError({
      message: `Error fetching annotation configs: ${error instanceof Error ? error.message : String(error)}`,
    });
    process.exit(getExitCodeForError(error));
  }
}

/**
 * Handler for `annotation-config delete`
 */
async function annotationConfigDeleteHandler(
  configId: string,
  options: AnnotationConfigDeleteOptions
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
      message: `Delete annotation config ${configId}? This cannot be undone.`,
      yes: options.yes,
    });

    const response = await client.DELETE("/v1/annotation_configs/{config_id}", {
      params: {
        path: {
          config_id: configId,
        },
      },
    });

    if (response.error) {
      throw new Error(`Failed to delete annotation config: ${response.error}`);
    }

    writeProgress({
      message: `Deleted annotation config ${configId}`,
      noProgress: !options.progress,
    });
  } catch (error) {
    writeError({
      message: `Error deleting annotation config: ${error instanceof Error ? error.message : String(error)}`,
    });
    process.exit(getExitCodeForError(error));
  }
}

/**
 * Handler for `annotation-config update`
 */
async function annotationConfigUpdateHandler(
  configIdentifier: string,
  options: AnnotationConfigUpdateOptions
): Promise<void> {
  // Input validation runs before the try block so its `process.exit` isn't
  // caught and re-mapped by the catch-all error handler below.

  // Require at least one field to update so an accidental no-op invocation
  // fails fast with the correct usage instead of silently re-writing the
  // config unchanged.
  const hasUpdate =
    options.name !== undefined ||
    options.description !== undefined ||
    options.optimizationDirection !== undefined ||
    options.lowerBound !== undefined ||
    options.upperBound !== undefined ||
    options.threshold !== undefined ||
    options.values !== undefined;
  if (!hasUpdate) {
    writeStructuredError({
      format: options.format,
      message: "No fields to update were provided",
      code: "INVALID_ARGUMENT",
      hint: "px annotation-config update <config-id> --name <name>",
    });
    process.exit(ExitCode.INVALID_ARGUMENT);
  }

  if (
    options.optimizationDirection !== undefined &&
    !OPTIMIZATION_DIRECTIONS.includes(
      options.optimizationDirection as OptimizationDirection
    )
  ) {
    writeStructuredError({
      format: options.format,
      message: `Invalid --optimization-direction '${options.optimizationDirection}'. Must be one of: ${OPTIMIZATION_DIRECTIONS.join(", ")}`,
      code: "INVALID_ARGUMENT",
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
      message: `Fetching annotation config ${configIdentifier}...`,
      noProgress: !options.progress,
    });

    const getResponse = await client.GET(
      "/v1/annotation_configs/{config_identifier}",
      {
        params: {
          path: {
            config_identifier: configIdentifier,
          },
        },
      }
    );

    if (getResponse.error || !getResponse.data) {
      throw new Error(
        `Failed to fetch annotation config: ${getResponse.error}`
      );
    }

    const existing = getResponse.data.data;
    const updatedData = buildUpdatedConfigData(existing, options);

    writeProgress({
      message: `Updating annotation config ${existing.id}...`,
      noProgress: !options.progress,
    });

    const updateResponse = await client.PUT(
      "/v1/annotation_configs/{config_id}",
      {
        params: {
          path: {
            config_id: existing.id,
          },
        },
        body: updatedData,
      }
    );

    if (updateResponse.error || !updateResponse.data) {
      throw new Error(
        `Failed to update annotation config: ${updateResponse.error}`
      );
    }

    writeOutput({
      message: formatAnnotationConfigOutput({
        config: updateResponse.data.data,
        format: options.format,
      }),
    });
  } catch (error) {
    writeError({
      message: `Error updating annotation config: ${error instanceof Error ? error.message : String(error)}`,
    });
    process.exit(getExitCodeForError(error));
  }
}

/**
 * Create the `annotation-config` command with subcommands
 */
export function createAnnotationConfigCommand(): Command {
  const command = new Command("annotation-config");
  command.description("Manage Phoenix annotation configurations");

  const listCommand = new Command("list");
  listCommand
    .description("List all annotation configurations")
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
      "Maximum number of annotation configs to fetch",
      parseInt
    )
    .action(annotationConfigListHandler);

  command.addCommand(listCommand);
  command.addCommand(createAnnotationConfigUpdateCommand());
  command.addCommand(createAnnotationConfigDeleteCommand());

  return command;
}

export function createAnnotationConfigUpdateCommand(): Command {
  return new Command("update")
    .description("Update an annotation configuration")
    .argument("<config-identifier>", "Annotation config name or ID")
    .option("--endpoint <url>", "Phoenix API endpoint")
    .option("--api-key <key>", "Phoenix API key for authentication")
    .option("--name <name>", "New name for the annotation config")
    .option("--description <description>", "New description")
    .option(
      "--optimization-direction <direction>",
      "Optimization direction: MINIMIZE, MAXIMIZE, or NONE"
    )
    .option(
      "--lower-bound <number>",
      "Lower bound (CONTINUOUS/FREEFORM configs)",
      parseFloat
    )
    .option(
      "--upper-bound <number>",
      "Upper bound (CONTINUOUS/FREEFORM configs)",
      parseFloat
    )
    .option("--threshold <number>", "Threshold (FREEFORM configs)", parseFloat)
    .option(
      "--values <json>",
      'Categorical values as JSON, e.g. \'[{"label":"good","score":1}]\''
    )
    .option(
      "--format <format>",
      "Output format: pretty, json, or raw",
      "pretty"
    )
    .option("--no-progress", "Disable progress indicators")
    .addHelpText(
      "after",
      "\nExamples:\n" +
        "  px annotation-config update my-config --description 'Updated description'\n" +
        "  px annotation-config update my-config --name renamed --optimization-direction MAXIMIZE\n" +
        '  px annotation-config update my-config --values \'[{"label":"good","score":1},{"label":"bad","score":0}]\'\n' +
        "  px annotation-config update cfg-123 --name renamed --format raw --no-progress | jq -r '.id'\n"
    )
    .action(annotationConfigUpdateHandler);
}

export function createAnnotationConfigDeleteCommand(): Command {
  return new Command("delete")
    .description("Delete an annotation configuration")
    .argument("<config-id>", "Annotation config ID")
    .option("--endpoint <url>", "Phoenix API endpoint")
    .option("--api-key <key>", "Phoenix API key for authentication")
    .option("-y, --yes", "Skip confirmation prompt")
    .option("--no-progress", "Disable progress indicators")
    .action(annotationConfigDeleteHandler);
}
