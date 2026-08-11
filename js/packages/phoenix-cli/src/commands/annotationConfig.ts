import type { componentsV1, PhoenixClient } from "@arizeai/phoenix-client";
import { Command } from "commander";

import { createPhoenixClient } from "../client";
import {
  getConfigErrorMessage,
  resolveConfig,
  validateConfig,
} from "../config";
import { assertDeletesEnabled, confirmOrExit } from "../confirm";
import {
  ExitCode,
  getExitCodeForError,
  InvalidArgumentError,
} from "../exitCodes";
import { writeError, writeOutput, writeProgress } from "../io";
import { collectString, parseNumberOption } from "../optionParsers";
import { writeStructuredError } from "../structuredError";
import {
  hasCategoricalValueInput,
  resolveCategoricalValues,
} from "./annotationConfigValues";
import {
  formatAnnotationConfigOutput,
  formatAnnotationConfigsOutput,
  type OutputFormat,
} from "./formatAnnotationConfigs";
import type { CommonOptions, DeleteOptions } from "./options";

type AnnotationConfig =
  | componentsV1["schemas"]["CategoricalAnnotationConfig"]
  | componentsV1["schemas"]["ContinuousAnnotationConfig"]
  | componentsV1["schemas"]["FreeformAnnotationConfig"];

type CreateAnnotationConfigData =
  componentsV1["schemas"]["CreateAnnotationConfigData"];

type OptimizationDirection = componentsV1["schemas"]["OptimizationDirection"];

type AnnotationConfigType = "CATEGORICAL" | "CONTINUOUS" | "FREEFORM";

const OPTIMIZATION_DIRECTIONS: readonly OptimizationDirection[] = [
  "MINIMIZE",
  "MAXIMIZE",
  "NONE",
];

const ANNOTATION_CONFIG_TYPES: readonly AnnotationConfigType[] = [
  "CATEGORICAL",
  "CONTINUOUS",
  "FREEFORM",
];

/**
 * Options for `px annotation-config list`.
 */
interface AnnotationConfigListOptions extends CommonOptions<OutputFormat> {
  /**
   * `--limit <number>`: Maximum number of annotation configs to fetch,
   * paging through the API's cursor until it is reached. Unset fetches all
   * of them.
   *
   * @example 10
   */
  limit?: number;
}

/**
 * Options for `px annotation-config get`. No fields beyond the shared base —
 * the target config is the `<config-identifier>` positional argument.
 */
type AnnotationConfigGetOptions = CommonOptions<OutputFormat>;

/**
 * Options for `px annotation-config create`.
 *
 * The type-specific flags (`lowerBound`, `upperBound`, `threshold`, `value`,
 * `values`) are validated against `type` by `assertFlagsValidForConfigType`
 * — passing one that doesn't apply to the chosen type is an
 * `INVALID_ARGUMENT` error, not a silent no-op.
 */
interface AnnotationConfigCreateOptions extends CommonOptions<OutputFormat> {
  /**
   * `--type <type>`: Config type — `CATEGORICAL`, `CONTINUOUS`, or
   * `FREEFORM`. Required. Case-insensitive; normalized to uppercase before
   * validation.
   *
   * @example "CATEGORICAL"
   */
  type?: string;
  /**
   * `--name <name>`: Annotation config name. Required. Applies to all types.
   *
   * @example "response-quality"
   */
  name?: string;
  /**
   * `--description <description>`: Human-readable description. Applies to
   * all types.
   *
   * @example "Pass/fail rating from human review"
   */
  description?: string;
  /**
   * `--optimization-direction <direction>`: `MINIMIZE`, `MAXIMIZE`, or
   * `NONE`. Applies to CATEGORICAL and CONTINUOUS configs, where it defaults
   * to `NONE` when omitted; for FREEFORM configs it is left `null` unless
   * explicitly set.
   *
   * @example "MAXIMIZE"
   */
  optimizationDirection?: string;
  /**
   * `--lower-bound <number>`: Lower bound of the score range. Valid for
   * CONTINUOUS and FREEFORM configs; rejected for CATEGORICAL.
   *
   * @example 0
   */
  lowerBound?: number;
  /**
   * `--upper-bound <number>`: Upper bound of the score range. Valid for
   * CONTINUOUS and FREEFORM configs; rejected for CATEGORICAL.
   *
   * @example 1
   */
  upperBound?: number;
  /**
   * `--threshold <number>`: Pass/fail threshold. Valid for FREEFORM configs
   * only; rejected for CATEGORICAL and CONTINUOUS.
   *
   * @example 0.5
   */
  threshold?: number;
  /**
   * `--value <label[=score]>`: Categorical label with optional score,
   * repeatable. Valid for CATEGORICAL configs only. CATEGORICAL configs
   * require at least one label via `--value` or `--values`.
   *
   * @example ["good=1", "bad=0"]
   */
  value?: string[];
  /**
   * `--values <json>`: Categorical values as a JSON array — a bulk/agent
   * alternative to repeating `--value`. Valid for CATEGORICAL configs only.
   *
   * @example '[{"label":"good","score":1},{"label":"bad","score":0}]'
   */
  values?: string;
}

/**
 * Options for `px annotation-config update`. The config `type` is immutable
 * (there is no `--type` flag here — delete and recreate to change it), and
 * every field is optional, but the handler requires at least one before
 * proceeding.
 *
 * The type-specific flags are validated against the *existing* config's
 * type by `assertFlagsValidForConfigType`, same as in
 * `AnnotationConfigCreateOptions`.
 */
interface AnnotationConfigUpdateOptions extends CommonOptions<OutputFormat> {
  /**
   * `--name <name>`: New name for the annotation config. Applies to all
   * types.
   *
   * @example "answer-quality"
   */
  name?: string;
  /**
   * `--description <description>`: New description. Applies to all types.
   *
   * @example "Updated rubric for response quality"
   */
  description?: string;
  /**
   * `--optimization-direction <direction>`: New `MINIMIZE`, `MAXIMIZE`, or
   * `NONE` direction. Applies to CATEGORICAL and CONTINUOUS configs; for
   * FREEFORM it may still be set explicitly.
   *
   * @example "MAXIMIZE"
   */
  optimizationDirection?: string;
  /**
   * `--lower-bound <number>`: New lower bound. Valid for CONTINUOUS and
   * FREEFORM configs; rejected for CATEGORICAL.
   *
   * @example -1
   */
  lowerBound?: number;
  /**
   * `--upper-bound <number>`: New upper bound. Valid for CONTINUOUS and
   * FREEFORM configs; rejected for CATEGORICAL.
   *
   * @example 1
   */
  upperBound?: number;
  /**
   * `--threshold <number>`: New pass/fail threshold. Valid for FREEFORM
   * configs only; rejected for CATEGORICAL and CONTINUOUS.
   *
   * @example 0.75
   */
  threshold?: number;
  /**
   * `--value <label[=score]>`: Replacement categorical label with optional
   * score, repeatable. Valid for CATEGORICAL configs only. Supplying any
   * `--value`/`--values` replaces the entire label set, not just the ones
   * named.
   *
   * @example ["good=1", "acceptable=0.5", "bad=0"]
   */
  value?: string[];
  /**
   * `--values <json>`: Replacement categorical values as a JSON array — a
   * bulk/agent alternative to repeating `--value`. Valid for CATEGORICAL
   * configs only.
   *
   * @example '[{"label":"good","score":1}]'
   */
  values?: string;
}

/**
 * Not a mirror of a Commander flag set — an internal validation shape.
 * Narrows `AnnotationConfigCreateOptions` and `AnnotationConfigUpdateOptions`
 * down to just the fields whose validity depends on the annotation config
 * type, so `assertFlagsValidForConfigType` can be shared between create and
 * update without depending on either's full (and slightly different)
 * options interface.
 */
interface TypeScopedFlagOptions {
  lowerBound?: number;
  upperBound?: number;
  threshold?: number;
  value?: string[];
  values?: string;
}

/**
 * Reject flags that don't apply to the config's type, so a mismatch (e.g.
 * `--threshold` on a categorical config) fails loudly instead of being
 * silently ignored. Shared by both create and update so the rules can't
 * drift between the two.
 */
function assertFlagsValidForConfigType(
  options: TypeScopedFlagOptions,
  type: AnnotationConfigType
): void {
  if (type === "CATEGORICAL") {
    if (options.lowerBound !== undefined || options.upperBound !== undefined) {
      throw new InvalidArgumentError(
        "--lower-bound and --upper-bound are not valid for CATEGORICAL configs"
      );
    }
    if (options.threshold !== undefined) {
      throw new InvalidArgumentError(
        "--threshold is not valid for CATEGORICAL configs"
      );
    }
    return;
  }
  if (hasCategoricalValueInput(options)) {
    throw new InvalidArgumentError(
      "--value/--values are only valid for CATEGORICAL configs"
    );
  }
  if (type === "CONTINUOUS" && options.threshold !== undefined) {
    throw new InvalidArgumentError(
      "--threshold is not valid for CONTINUOUS configs"
    );
  }
}

/**
 * Build the full config body for `POST /v1/annotation_configs` from create
 * flags.
 *
 * `optimization_direction` is required by the API for categorical and
 * continuous configs; when omitted it defaults to `NONE`. Freeform configs
 * leave it null unless explicitly set.
 */
function buildCreateConfigData(
  options: AnnotationConfigCreateOptions,
  type: AnnotationConfigType
): CreateAnnotationConfigData {
  assertFlagsValidForConfigType(options, type);

  const name = options.name as string;
  const description = options.description;
  const optimizationDirection =
    (options.optimizationDirection as OptimizationDirection | undefined) ??
    "NONE";

  if (type === "CATEGORICAL") {
    const values = resolveCategoricalValues(options);
    if (!values) {
      throw new InvalidArgumentError(
        "CATEGORICAL configs require at least one --value (or --values JSON)"
      );
    }
    return {
      type: "CATEGORICAL",
      name,
      description,
      optimization_direction: optimizationDirection,
      values,
    };
  }

  if (type === "CONTINUOUS") {
    return {
      type: "CONTINUOUS",
      name,
      description,
      optimization_direction: optimizationDirection,
      lower_bound: options.lowerBound ?? null,
      upper_bound: options.upperBound ?? null,
    };
  }

  return {
    type: "FREEFORM",
    name,
    description,
    optimization_direction: options.optimizationDirection
      ? optimizationDirection
      : null,
    threshold: options.threshold ?? null,
    lower_bound: options.lowerBound ?? null,
    upper_bound: options.upperBound ?? null,
  };
}

/**
 * Merge the provided update options onto an existing annotation config to
 * produce the full replacement body required by `PUT
 * /v1/annotation_configs/{id}`. Only fields the caller supplied are changed;
 * everything else is carried over from `existing`. The config `type` is
 * immutable — to change it, delete and recreate the config.
 */
function buildUpdatedConfigData(
  existing: AnnotationConfig,
  options: AnnotationConfigUpdateOptions
): CreateAnnotationConfigData {
  assertFlagsValidForConfigType(options, existing.type);

  const name = options.name ?? existing.name;
  const description =
    options.description !== undefined
      ? options.description
      : existing.description;
  const optimizationDirection =
    (options.optimizationDirection as OptimizationDirection | undefined) ??
    existing.optimization_direction;

  if (existing.type === "CATEGORICAL") {
    const resolvedValues = resolveCategoricalValues(options);
    return {
      type: "CATEGORICAL",
      name,
      description,
      optimization_direction:
        optimizationDirection ?? existing.optimization_direction,
      values: resolvedValues ?? existing.values,
    };
  }

  if (existing.type === "CONTINUOUS") {
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
 * Validate the numeric and enum flags shared by `create` and `update`,
 * exiting with `INVALID_ARGUMENT` on the first invalid one. Runs before the
 * handler's `try` block so the exit code isn't re-mapped by the catch-all.
 *
 * Normalizes `optimizationDirection` to uppercase in place so it is
 * case-insensitive, matching how `--type` is treated.
 */
function exitOnInvalidSharedWriteFlags(options: {
  format?: OutputFormat;
  optimizationDirection?: string;
  lowerBound?: number;
  upperBound?: number;
  threshold?: number;
}): void {
  const numericFlags = [
    ["--lower-bound", options.lowerBound],
    ["--upper-bound", options.upperBound],
    ["--threshold", options.threshold],
  ] as const;
  for (const [flag, value] of numericFlags) {
    if (value !== undefined && !Number.isFinite(value)) {
      writeStructuredError({
        format: options.format,
        message: `${flag} must be a finite number`,
        code: "INVALID_ARGUMENT",
      });
      process.exit(ExitCode.INVALID_ARGUMENT);
    }
  }
  if (options.optimizationDirection !== undefined) {
    const rawDirection = options.optimizationDirection;
    options.optimizationDirection = rawDirection.toUpperCase();
    if (
      !OPTIMIZATION_DIRECTIONS.includes(
        options.optimizationDirection as OptimizationDirection
      )
    ) {
      writeStructuredError({
        format: options.format,
        message: `Invalid --optimization-direction '${rawDirection}'. Must be one of: ${OPTIMIZATION_DIRECTIONS.join(", ")}`,
        code: "INVALID_ARGUMENT",
      });
      process.exit(ExitCode.INVALID_ARGUMENT);
    }
  }
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
 * Handler for `annotation-config get`
 */
async function annotationConfigGetHandler(
  configIdentifier: string,
  options: AnnotationConfigGetOptions
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
      message: `Fetching annotation config ${configIdentifier}...`,
      noProgress: !options.progress,
    });

    const response = await client.GET(
      "/v1/annotation_configs/{config_identifier}",
      {
        params: {
          path: {
            config_identifier: configIdentifier,
          },
        },
      }
    );

    // The client throws on non-2xx responses (e.g. a 404 for an unknown
    // identifier), so this guard only trips on an unexpected empty body.
    if (response.error || !response.data) {
      throw new Error(
        `Annotation config '${configIdentifier}' not found${response.error ? `: ${response.error}` : ""}`
      );
    }

    writeOutput({
      message: formatAnnotationConfigOutput({
        config: response.data.data,
        format: options.format,
      }),
    });
  } catch (error) {
    writeError({
      message: `Error fetching annotation config: ${error instanceof Error ? error.message : String(error)}`,
    });
    process.exit(getExitCodeForError(error));
  }
}

/**
 * Handler for `annotation-config create`
 */
async function annotationConfigCreateHandler(
  options: AnnotationConfigCreateOptions
): Promise<void> {
  // Argument-shape validation runs before the try block so its `process.exit`
  // isn't caught and re-mapped by the catch-all error handler below.
  if (!options.type) {
    writeStructuredError({
      format: options.format,
      message: "Missing required flag --type",
      code: "INVALID_ARGUMENT",
      hint: "px annotation-config create --type CATEGORICAL --name <name> --value good=1",
    });
    process.exit(ExitCode.INVALID_ARGUMENT);
  }
  const type = options.type.toUpperCase() as AnnotationConfigType;
  if (!ANNOTATION_CONFIG_TYPES.includes(type)) {
    writeStructuredError({
      format: options.format,
      message: `Invalid --type '${options.type}'. Must be one of: ${ANNOTATION_CONFIG_TYPES.join(", ")}`,
      code: "INVALID_ARGUMENT",
    });
    process.exit(ExitCode.INVALID_ARGUMENT);
  }
  if (!options.name) {
    writeStructuredError({
      format: options.format,
      message: "Missing required flag --name",
      code: "INVALID_ARGUMENT",
      hint: `px annotation-config create --type ${type} --name <name>`,
    });
    process.exit(ExitCode.INVALID_ARGUMENT);
  }
  exitOnInvalidSharedWriteFlags(options);
  if (type === "CATEGORICAL" && !hasCategoricalValueInput(options)) {
    writeStructuredError({
      format: options.format,
      message:
        "CATEGORICAL configs require at least one --value (or --values JSON)",
      code: "INVALID_ARGUMENT",
      hint: `px annotation-config create --type CATEGORICAL --name ${options.name} --value good=1 --value bad=0`,
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

    const body = buildCreateConfigData(options, type);

    writeProgress({
      message: `Creating annotation config ${options.name}...`,
      noProgress: !options.progress,
    });

    const response = await client.POST("/v1/annotation_configs", {
      body,
    });

    if (response.error || !response.data) {
      throw new Error(`Failed to create annotation config: ${response.error}`);
    }

    writeOutput({
      message: formatAnnotationConfigOutput({
        config: response.data.data,
        format: options.format,
      }),
    });
  } catch (error) {
    writeError({
      message: `Error creating annotation config: ${error instanceof Error ? error.message : String(error)}`,
    });
    process.exit(getExitCodeForError(error));
  }
}

/**
 * Handler for `annotation-config delete`
 */
async function annotationConfigDeleteHandler(
  configId: string,
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
  // Argument-shape validation runs before the try block so its `process.exit`
  // isn't caught and re-mapped by the catch-all error handler below.

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
    hasCategoricalValueInput(options);
  if (!hasUpdate) {
    writeStructuredError({
      format: options.format,
      message: "No fields to update were provided",
      code: "INVALID_ARGUMENT",
      hint: "px annotation-config update <config-id> --name <name>",
    });
    process.exit(ExitCode.INVALID_ARGUMENT);
  }

  exitOnInvalidSharedWriteFlags(options);

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
 * Attach the shared categorical value-input options to a command. Both
 * `create` and `update` accept values the same way: a repeatable, shell-
 * friendly `--value label[=score]` flag, or a single `--values` JSON payload
 * for bulk/agent use.
 */
function addCategoricalValueOptions(command: Command): Command {
  return command
    .option(
      "--value <label[=score]>",
      "Categorical label with optional score, e.g. good=1 (repeatable; CATEGORICAL configs)",
      collectString,
      []
    )
    .option(
      "--values <json>",
      'Categorical values as JSON — bulk/agent alternative to --value, e.g. \'[{"label":"good","score":1}]\''
    );
}

/**
 * Create the `annotation-config` command with subcommands
 */
export function createAnnotationConfigCommand(): Command {
  const command = new Command("annotation-config");
  command.description("Manage Phoenix annotation configurations");

  command.addCommand(createAnnotationConfigListCommand());
  command.addCommand(createAnnotationConfigGetCommand());
  command.addCommand(createAnnotationConfigCreateCommand());
  command.addCommand(createAnnotationConfigUpdateCommand());
  command.addCommand(createAnnotationConfigDeleteCommand());

  return command;
}

export function createAnnotationConfigListCommand(): Command {
  return new Command("list")
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
    .addHelpText(
      "after",
      "\nExamples:\n" +
        "  # Show all annotation configs as a table\n" +
        "  px annotation-config list\n\n" +
        "  # Extract config names as JSON (agent-friendly)\n" +
        "  px annotation-config list --format raw --no-progress | jq -r '.[].name'\n\n" +
        "  # Fetch at most 10 configs\n" +
        "  px annotation-config list --limit 10\n"
    )
    .action(annotationConfigListHandler);
}

export function createAnnotationConfigGetCommand(): Command {
  return new Command("get")
    .description("Fetch an annotation configuration by name or ID")
    .argument("<config-identifier>", "Annotation config name or ID")
    .option("--endpoint <url>", "Phoenix API endpoint")
    .option("--api-key <key>", "Phoenix API key for authentication")
    .option(
      "--format <format>",
      "Output format: pretty, json, or raw",
      "pretty"
    )
    .option("--no-progress", "Disable progress indicators")
    .addHelpText(
      "after",
      "\nExamples:\n" +
        "  # Look up a config by name\n" +
        "  px annotation-config get response-quality\n\n" +
        "  # Resolve a config name to its ID (agent-friendly)\n" +
        "  px annotation-config get response-quality --format raw --no-progress | jq -r '.id'\n\n" +
        "  # Inspect the labels of a categorical config\n" +
        "  px annotation-config get response-quality --format raw --no-progress | jq '.values'\n"
    )
    .action(annotationConfigGetHandler);
}

export function createAnnotationConfigCreateCommand(): Command {
  const command = new Command("create")
    .description("Create a new annotation configuration")
    .option(
      "--type <type>",
      "Config type: CATEGORICAL, CONTINUOUS, or FREEFORM"
    )
    .option("--name <name>", "Annotation config name")
    .option("--endpoint <url>", "Phoenix API endpoint")
    .option("--api-key <key>", "Phoenix API key for authentication")
    .option("--description <description>", "Annotation config description")
    .option(
      "--optimization-direction <direction>",
      "Optimization direction: MINIMIZE, MAXIMIZE, or NONE (default: NONE)"
    )
    .option(
      "--lower-bound <number>",
      "Lower bound (CONTINUOUS/FREEFORM configs)",
      parseNumberOption
    )
    .option(
      "--upper-bound <number>",
      "Upper bound (CONTINUOUS/FREEFORM configs)",
      parseNumberOption
    )
    .option(
      "--threshold <number>",
      "Threshold (FREEFORM configs)",
      parseNumberOption
    );

  addCategoricalValueOptions(command);

  return command
    .option(
      "--format <format>",
      "Output format: pretty, json, or raw",
      "pretty"
    )
    .option("--no-progress", "Disable progress indicators")
    .addHelpText(
      "after",
      "\nExamples:\n" +
        "  # Pass/fail quality rating with scored labels (higher is better)\n" +
        "  px annotation-config create --type CATEGORICAL --name response-quality --value good=1 --value bad=0 --optimization-direction MAXIMIZE\n\n" +
        "  # Sentiment labels without scores\n" +
        "  px annotation-config create --type CATEGORICAL --name sentiment --value positive --value neutral --value negative\n\n" +
        "  # Confidence score between 0 and 1\n" +
        "  px annotation-config create --type CONTINUOUS --name confidence --lower-bound 0 --upper-bound 1 --optimization-direction MAXIMIZE\n\n" +
        "  # Free-text feedback from human reviewers\n" +
        "  px annotation-config create --type FREEFORM --name reviewer-notes --description 'Free-form reviewer feedback'\n\n" +
        "  # Create from a JSON payload and capture the new config ID (agent-friendly)\n" +
        '  px annotation-config create --type CATEGORICAL --name response-quality --values \'[{"label":"good","score":1},{"label":"bad","score":0}]\' --format raw --no-progress | jq -r \'.id\'\n'
    )
    .action(annotationConfigCreateHandler);
}

export function createAnnotationConfigUpdateCommand(): Command {
  const command = new Command("update")
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
      parseNumberOption
    )
    .option(
      "--upper-bound <number>",
      "Upper bound (CONTINUOUS/FREEFORM configs)",
      parseNumberOption
    )
    .option(
      "--threshold <number>",
      "Threshold (FREEFORM configs)",
      parseNumberOption
    );

  addCategoricalValueOptions(command);

  return command
    .option(
      "--format <format>",
      "Output format: pretty, json, or raw",
      "pretty"
    )
    .option("--no-progress", "Disable progress indicators")
    .addHelpText(
      "after",
      "\nExamples:\n" +
        "  # Change only the description; every other field is preserved\n" +
        "  px annotation-config update response-quality --description 'Pass/fail rating from human review'\n\n" +
        "  # Rename a config and set its optimization direction\n" +
        "  px annotation-config update response-quality --name answer-quality --optimization-direction MAXIMIZE\n\n" +
        "  # Replace the label set of a categorical config\n" +
        "  px annotation-config update response-quality --value good=1 --value acceptable=0.5 --value bad=0\n\n" +
        "  # Widen the range of a continuous config\n" +
        "  px annotation-config update confidence --lower-bound -1 --upper-bound 1\n\n" +
        "  # Update and capture the config ID (agent-friendly)\n" +
        "  px annotation-config update response-quality --description 'Updated' --format raw --no-progress | jq -r '.id'\n"
    )
    .action(annotationConfigUpdateHandler);
}

export function createAnnotationConfigDeleteCommand(): Command {
  return new Command("delete")
    .description("Delete an annotation configuration")
    .argument(
      "<config-id>",
      "Annotation config ID (resolve a name with: px annotation-config get <name>)"
    )
    .option("--endpoint <url>", "Phoenix API endpoint")
    .option("--api-key <key>", "Phoenix API key for authentication")
    .option("-y, --yes", "Skip confirmation prompt")
    .option("--no-progress", "Disable progress indicators")
    .addHelpText(
      "after",
      "\nDeletes are disabled unless PHOENIX_CLI_DANGEROUSLY_ENABLE_DELETES=true is set.\n" +
        "\nExamples:\n" +
        "  # Delete with an interactive confirmation prompt\n" +
        "  px annotation-config delete QW5ub3RhdGlvbkNvbmZpZzoxMjM=\n\n" +
        "  # Skip the confirmation prompt (for scripts and agents)\n" +
        "  px annotation-config delete QW5ub3RhdGlvbkNvbmZpZzoxMjM= --yes\n\n" +
        "  # Resolve a name to its ID, then delete it\n" +
        "  px annotation-config get response-quality --format raw --no-progress | jq -r '.id' | xargs px annotation-config delete --yes\n"
    )
    .action(annotationConfigDeleteHandler);
}
