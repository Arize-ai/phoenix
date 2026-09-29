import type { componentsV1, PhoenixClient } from "@arizeai/phoenix-client";
import {
  createCodeEvaluatorVersion,
  createEvaluator,
  deleteEvaluator,
  getCodeEvaluatorVersions,
  getEvaluator,
  getEvaluators,
  updateEvaluator,
} from "@arizeai/phoenix-client/evaluators";
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
  exitCodeName,
  getExitCodeForError,
  InvalidArgumentError,
} from "../exitCodes";
import { writeError, writeOutput, writeProgress } from "../io";
import { parsePositiveIntOption } from "../optionParsers";
import { writeStructuredError } from "../structuredError";
import { describeError } from "./evaluatorErrors";
import {
  parseJsonArrayFlag,
  parseJsonObjectFlag,
  readInlineOrFile,
} from "./evaluatorInputs";
import {
  formatEvaluatorOutput,
  formatEvaluatorsOutput,
  formatEvaluatorVersionOutput,
  formatEvaluatorVersionsOutput,
  type OutputFormat,
} from "./formatEvaluator";
import type { CommonOptions, DeleteOptions } from "./options";

type LLMEvaluatorPatch = componentsV1["schemas"]["PatchLLMEvaluatorRequest"];
type CodeEvaluatorPatch = componentsV1["schemas"]["PatchCodeEvaluatorRequest"];
type EvaluatorPatch = LLMEvaluatorPatch | CodeEvaluatorPatch;
type InputMapping = componentsV1["schemas"]["InputMapping"];
type CategoricalOutputConfig =
  componentsV1["schemas"]["CategoricalAnnotationConfigData"];
type CodeOutputConfig = NonNullable<
  CodeEvaluatorPatch["output_configs"]
>[number];
type VersionRequest = componentsV1["schemas"]["CodeEvaluatorVersionRequest"];
type VersionConfiguration = Omit<
  VersionRequest,
  "source_code" | "expected_current_version_id"
>;

const EVALUATOR_TYPES = ["llm", "code"] as const;
type EvaluatorType = (typeof EVALUATOR_TYPES)[number];

const LANGUAGES = ["PYTHON", "TYPESCRIPT"] as const;
type Language = (typeof LANGUAGES)[number];

/**
 * Options for `px evaluator list`.
 */
interface EvaluatorListOptions extends CommonOptions<OutputFormat> {
  /**
   * `--type <llm|code>`: Return only one kind of definition.
   *
   * @example "code"
   */
  type?: string;
  /**
   * `--name <name>`: Return only the evaluator with this exact name.
   *
   * @example "exact-match"
   */
  name?: string;
  /**
   * `--limit <number>`: Maximum number of definitions to fetch.
   *
   * @example 50
   */
  limit?: number;
}

/**
 * Options for `px evaluator get <evaluator-id>`.
 */
type EvaluatorGetOptions = CommonOptions<OutputFormat>;

/**
 * Options for `px evaluator create`: a code evaluator that nothing binds yet.
 */
interface EvaluatorCreateOptions extends CommonOptions<OutputFormat> {
  /**
   * `--name <name>`: Name unique among evaluators. Required.
   *
   * @example "exact-match"
   */
  name?: string;
  /**
   * `--source-code <text>`: The full source, inline.
   */
  sourceCode?: string;
  /**
   * `--file <path>`: Read the source from a file.
   *
   * @example "./evaluator.py"
   */
  file?: string;
  /**
   * `--language <PYTHON|TYPESCRIPT>`: The language of the source. Required.
   */
  language?: string;
  /**
   * `--sandbox-config-id <id>`: Sandbox configuration to run in. Required.
   *
   * @example "U2FuZGJveENvbmZpZzox"
   */
  sandboxConfigId?: string;
  /**
   * `--input-mapping <json>`: Default mapping from record fields to the
   * function's arguments. Required.
   *
   * @example '{"literal_mapping":{},"path_mapping":{"output":"output"}}'
   */
  inputMapping?: string;
  /**
   * `--description <text>`: A description.
   */
  description?: string;
  /**
   * `--output-configs <json>`: JSON array of output configurations. Required;
   * at least one.
   *
   * @example '[{"type":"CONTINUOUS","name":"score","optimization_direction":"MAXIMIZE"}]'
   */
  outputConfigs?: string;
}

/**
 * Options for `px evaluator update <evaluator-id>`. `--type` selects which
 * kind of patch is sent; the remaining flags are the fields that kind accepts.
 */
interface EvaluatorUpdateOptions extends CommonOptions<OutputFormat> {
  /**
   * `--type <llm|code>`: The kind of evaluator being updated. Required, and
   * must match the evaluator on the server.
   *
   * @example "llm"
   */
  type?: string;
  /**
   * `--name <name>`: New name for the evaluator.
   *
   * @example "toxicity"
   */
  name?: string;
  /**
   * `--description <text>`: New description. For LLM evaluators it must equal
   * the description of the prompt's tool function.
   *
   * @example "Flags responses that contradict the retrieved context"
   */
  description?: string;
  /**
   * `--clear-description`: Remove the description.
   */
  clearDescription?: boolean;
  /**
   * `--output-configs <json>`: JSON array of output configurations. LLM
   * evaluators accept categorical configs only.
   */
  outputConfigs?: string;
  /**
   * `--prompt-version-id <id>`: (LLM) The prompt version to run. Prompt
   * content is created through the prompts API; this flag only moves the
   * evaluator to an existing version.
   *
   * @example "UHJvbXB0VmVyc2lvbjo3"
   */
  promptVersionId?: string;
  /**
   * `--sandbox-config-id <id>`: (code) Sandbox configuration to run in.
   *
   * @example "U2FuZGJveENvbmZpZzox"
   */
  sandboxConfigId?: string;
  /**
   * `--clear-sandbox-config`: (code) Detach the sandbox configuration.
   */
  clearSandboxConfig?: boolean;
  /**
   * `--input-mapping <json>`: (code) JSON object with `literal_mapping` and
   * `path_mapping` keys mapping record fields onto evaluator arguments.
   */
  inputMapping?: string;
}

/**
 * Options for `px evaluator delete <evaluator-id>`.
 */
type EvaluatorDeleteOptions = DeleteOptions;

/**
 * Options for `px evaluator version list <evaluator-id>`.
 */
interface EvaluatorVersionListOptions extends CommonOptions<OutputFormat> {
  /**
   * `--limit <number>`: Maximum number of versions to fetch.
   *
   * @example 10
   */
  limit?: number;
}

/**
 * Options for `px evaluator version create <evaluator-id>`.
 */
interface EvaluatorVersionCreateOptions extends CommonOptions<OutputFormat> {
  /**
   * `--source-code <text>`: The full source of the new version, inline.
   */
  sourceCode?: string;
  /**
   * `--file <path>`: Read the source of the new version from a file.
   *
   * @example "./evaluator.py"
   */
  file?: string;
  /**
   * `--expected-current-version <id>`: Refuse to deploy if another version has
   * been appended since this one was current.
   *
   * @example "Q29kZUV2YWx1YXRvclZlcnNpb246MQ=="
   */
  expectedCurrentVersion?: string;
  /**
   * `--description <text>`: Description applied together with the new code.
   */
  description?: string;
  /**
   * `--sandbox-config-id <id>`: Sandbox the new code runs in, applied together
   * with it.
   */
  sandboxConfigId?: string;
  /**
   * `--input-mapping <json>`: Default input mapping for the new code's
   * arguments, applied together with it.
   */
  inputMapping?: string;
  /**
   * `--output-configs <json>`: Outputs the new code produces, applied together
   * with it.
   */
  outputConfigs?: string;
}

function createClientOrExit(
  options: CommonOptions<OutputFormat> | DeleteOptions
): PhoenixClient {
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

function parseChoiceOrExit<T extends string>({
  flag,
  value,
  allowed,
  format,
  normalize,
}: {
  flag: string;
  value: string;
  allowed: readonly T[];
  format?: OutputFormat;
  normalize: (value: string) => string;
}): T {
  const choice = normalize(value) as T;
  if (!allowed.includes(choice)) {
    writeStructuredError({
      format,
      message: `Invalid ${flag} '${value}'. Must be one of: ${allowed.join(", ")}`,
      code: "INVALID_ARGUMENT",
    });
    process.exit(ExitCode.INVALID_ARGUMENT);
  }
  return choice;
}

function exitOnContradiction({
  format,
  pairs,
}: {
  format?: OutputFormat;
  pairs: Array<[string, string, boolean]>;
}): void {
  for (const [setFlag, clearFlag, both] of pairs) {
    if (both) {
      writeStructuredError({
        format,
        message: `Specify either ${setFlag} or ${clearFlag}, not both`,
        code: "INVALID_ARGUMENT",
      });
      process.exit(ExitCode.INVALID_ARGUMENT);
    }
  }
}

async function exitWithError({
  verb,
  error,
  format,
}: {
  verb: string;
  error: unknown;
  format?: OutputFormat;
}): Promise<never> {
  const exitCode = getExitCodeForError(error);
  writeStructuredError({
    format,
    message: `Error ${verb}: ${await describeError(error)}`,
    code: exitCodeName(exitCode),
    hint: error instanceof InvalidArgumentError ? error.hint : undefined,
  });
  process.exit(exitCode);
}

/** Reject a `--limit` that parsed to NaN (zero, negative, fractional, or not a number). */
function requireValidLimitOrExit({
  limit,
  format,
}: {
  limit: number | undefined;
  format?: OutputFormat;
}): void {
  if (limit !== undefined && Number.isNaN(limit)) {
    writeStructuredError({
      format,
      message: "--limit must be a positive integer",
      code: "INVALID_ARGUMENT",
    });
    process.exit(ExitCode.INVALID_ARGUMENT);
  }
}

/**
 * Handler for `evaluator list`
 */
async function evaluatorListHandler(
  options: EvaluatorListOptions
): Promise<void> {
  const type =
    options.type === undefined
      ? undefined
      : parseChoiceOrExit({
          flag: "--type",
          value: options.type,
          allowed: EVALUATOR_TYPES,
          format: options.format,
          normalize: (value) => value.toLowerCase(),
        });

  requireValidLimitOrExit({ limit: options.limit, format: options.format });

  try {
    const client = createClientOrExit(options);

    writeProgress({
      message: "Fetching evaluators...",
      noProgress: !options.progress,
    });

    const evaluators = await getEvaluators({
      client,
      type,
      name: options.name,
      limit: options.limit,
    });

    writeProgress({
      message: `Found ${evaluators.length} evaluator(s)`,
      noProgress: !options.progress,
    });

    writeOutput({
      message: formatEvaluatorsOutput({ evaluators, format: options.format }),
    });
  } catch (error) {
    await exitWithError({
      verb: "fetching evaluators",
      error,
      format: options.format,
    });
  }
}

/**
 * Handler for `evaluator get`
 */
async function evaluatorGetHandler(
  evaluatorId: string,
  options: EvaluatorGetOptions
): Promise<void> {
  try {
    const client = createClientOrExit(options);

    writeProgress({
      message: `Fetching evaluator ${evaluatorId}...`,
      noProgress: !options.progress,
    });

    const evaluator = await getEvaluator({ client, evaluatorId });

    writeOutput({
      message: formatEvaluatorOutput({ evaluator, format: options.format }),
    });
  } catch (error) {
    await exitWithError({
      verb: "fetching evaluator",
      error,
      format: options.format,
    });
  }
}

/**
 * Handler for `evaluator create`
 */
async function evaluatorCreateHandler(
  options: EvaluatorCreateOptions
): Promise<void> {
  // Argument-shape validation runs before the try block so its `process.exit`
  // isn't caught and re-mapped by the catch-all error handler below.
  const usage =
    "px evaluator create --name <name> --file evaluator.py --language PYTHON --sandbox-config-id <id> --input-mapping <json> --output-configs <json>";
  for (const [flag, value] of [
    ["--name", options.name],
    ["--language", options.language],
    ["--sandbox-config-id", options.sandboxConfigId],
    ["--input-mapping", options.inputMapping],
    ["--output-configs", options.outputConfigs],
  ] as const) {
    if (!value) {
      writeStructuredError({
        format: options.format,
        message: `Missing required flag ${flag}`,
        code: "INVALID_ARGUMENT",
        hint: usage,
      });
      process.exit(ExitCode.INVALID_ARGUMENT);
    }
  }
  const language = parseChoiceOrExit<Language>({
    flag: "--language",
    value: options.language ?? "",
    allowed: LANGUAGES,
    format: options.format,
    normalize: (value) => value.toUpperCase(),
  });

  try {
    const sourceCode = readInlineOrFile({
      inline: options.sourceCode,
      inlineFlag: "--source-code",
      file: options.file,
      fileFlag: "--file",
    });
    const client = createClientOrExit(options);

    writeProgress({
      message: `Creating evaluator ${options.name}...`,
      noProgress: !options.progress,
    });

    const evaluator = await createEvaluator({
      client,
      evaluator: {
        type: "code",
        name: options.name ?? "",
        source_code: sourceCode,
        language,
        sandbox_config_id: options.sandboxConfigId ?? "",
        input_mapping: parseJsonObjectFlag<InputMapping>({
          flag: "--input-mapping",
          value: options.inputMapping ?? "",
        }),
        output_configs: parseJsonArrayFlag<CodeOutputConfig>({
          flag: "--output-configs",
          value: options.outputConfigs ?? "",
          nonEmpty: { hint: usage },
        }),
        ...(options.description !== undefined && {
          description: options.description,
        }),
      },
    });

    writeOutput({
      message: formatEvaluatorOutput({ evaluator, format: options.format }),
    });
  } catch (error) {
    await exitWithError({
      verb: "creating evaluator",
      error,
      format: options.format,
    });
  }
}

/** A command that prints a definition's current output configs. */
function currentOutputConfigsHint(evaluatorId: string): string {
  return `px evaluator get ${evaluatorId} --format raw --no-progress | jq '.output_configs'`;
}

function exitOnFlagsForOtherType({
  type,
  options,
}: {
  type: EvaluatorType;
  options: EvaluatorUpdateOptions;
}): void {
  const llmOnly = [["--prompt-version-id", options.promptVersionId]] as const;
  const codeOnly = [
    ["--sandbox-config-id", options.sandboxConfigId],
    ["--clear-sandbox-config", options.clearSandboxConfig],
    ["--input-mapping", options.inputMapping],
  ] as const;
  const misplaced = (type === "llm" ? codeOnly : llmOnly)
    .filter(([, value]) => value !== undefined && value !== false)
    .map(([flag]) => flag);
  if (misplaced.length > 0) {
    writeStructuredError({
      format: options.format,
      message: `${misplaced.join(", ")} cannot be used with --type ${type}`,
      code: "INVALID_ARGUMENT",
    });
    process.exit(ExitCode.INVALID_ARGUMENT);
  }
}

/**
 * Build the discriminated patch body from the update flags. Only flags the
 * user passed are included, so omitted fields keep their server-side values.
 */
function buildEvaluatorPatch({
  evaluatorId,
  type,
  options,
}: {
  evaluatorId: string;
  type: EvaluatorType;
  options: EvaluatorUpdateOptions;
}): EvaluatorPatch {
  const nonEmpty = { hint: currentOutputConfigsHint(evaluatorId) };
  const shared = {
    ...(options.name !== undefined && { name: options.name }),
    ...(options.description !== undefined && {
      description: options.description,
    }),
    ...(options.clearDescription && { description: null }),
  };
  if (type === "llm") {
    const patch: LLMEvaluatorPatch = { type: "llm", ...shared };
    if (options.outputConfigs !== undefined) {
      patch.output_configs = parseJsonArrayFlag<CategoricalOutputConfig>({
        flag: "--output-configs",
        value: options.outputConfigs,
        nonEmpty,
      });
    }
    if (options.promptVersionId !== undefined) {
      patch.prompt_version_id = options.promptVersionId;
    }
    return patch;
  }
  const patch: CodeEvaluatorPatch = { type: "code", ...shared };
  if (options.outputConfigs !== undefined) {
    patch.output_configs = parseJsonArrayFlag<CodeOutputConfig>({
      flag: "--output-configs",
      value: options.outputConfigs,
      nonEmpty,
    });
  }
  if (options.sandboxConfigId !== undefined) {
    patch.sandbox_config_id = options.sandboxConfigId;
  }
  if (options.clearSandboxConfig) {
    patch.sandbox_config_id = null;
  }
  if (options.inputMapping !== undefined) {
    patch.input_mapping = parseJsonObjectFlag<InputMapping>({
      flag: "--input-mapping",
      value: options.inputMapping,
    });
  }
  return patch;
}

/**
 * Handler for `evaluator update`
 */
async function evaluatorUpdateHandler(
  evaluatorId: string,
  options: EvaluatorUpdateOptions
): Promise<void> {
  // Argument-shape validation runs before the try block so its `process.exit`
  // isn't caught and re-mapped by the catch-all error handler below.
  if (!options.type) {
    writeStructuredError({
      format: options.format,
      message: "Missing required flag --type",
      code: "INVALID_ARGUMENT",
      hint: `px evaluator update ${evaluatorId} --type llm --description <text>`,
    });
    process.exit(ExitCode.INVALID_ARGUMENT);
  }
  const type = parseChoiceOrExit({
    flag: "--type",
    value: options.type,
    allowed: EVALUATOR_TYPES,
    format: options.format,
    normalize: (value) => value.toLowerCase(),
  });
  exitOnFlagsForOtherType({ type, options });
  exitOnContradiction({
    format: options.format,
    pairs: [
      [
        "--description",
        "--clear-description",
        options.description !== undefined && Boolean(options.clearDescription),
      ],
      [
        "--sandbox-config-id",
        "--clear-sandbox-config",
        options.sandboxConfigId !== undefined &&
          Boolean(options.clearSandboxConfig),
      ],
    ],
  });
  const fieldFlags = [
    options.name,
    options.description,
    options.clearDescription,
    options.outputConfigs,
    options.promptVersionId,
    options.sandboxConfigId,
    options.clearSandboxConfig,
    options.inputMapping,
  ];
  if (fieldFlags.every((value) => value === undefined || value === false)) {
    writeStructuredError({
      format: options.format,
      message: "Nothing to update: pass at least one field flag",
      code: "INVALID_ARGUMENT",
      hint: `px evaluator update ${evaluatorId} --type ${type} --name <name>`,
    });
    process.exit(ExitCode.INVALID_ARGUMENT);
  }

  try {
    const patch = buildEvaluatorPatch({ evaluatorId, type, options });
    const client = createClientOrExit(options);

    writeProgress({
      message: `Updating evaluator ${evaluatorId}...`,
      noProgress: !options.progress,
    });

    const evaluator = await updateEvaluator({ client, evaluatorId, patch });

    writeOutput({
      message: formatEvaluatorOutput({ evaluator, format: options.format }),
    });
  } catch (error) {
    await exitWithError({
      verb: "updating evaluator",
      error,
      format: options.format,
    });
  }
}

/**
 * Handler for `evaluator delete`
 */
async function evaluatorDeleteHandler(
  evaluatorId: string,
  options: EvaluatorDeleteOptions
): Promise<void> {
  try {
    assertDeletesEnabled();

    const client = createClientOrExit(options);

    await confirmOrExit({
      message: `Delete evaluator ${evaluatorId} and its version history? This cannot be undone.`,
      yes: options.yes,
    });

    await deleteEvaluator({ client, evaluatorId });

    writeProgress({
      message: `Deleted evaluator ${evaluatorId}`,
      noProgress: !options.progress,
    });
  } catch (error) {
    await exitWithError({ verb: "deleting evaluator", error });
  }
}

/**
 * Handler for `evaluator version list`
 */
async function evaluatorVersionListHandler(
  evaluatorId: string,
  options: EvaluatorVersionListOptions
): Promise<void> {
  requireValidLimitOrExit({ limit: options.limit, format: options.format });

  try {
    const client = createClientOrExit(options);

    writeProgress({
      message: `Fetching versions of evaluator ${evaluatorId}...`,
      noProgress: !options.progress,
    });

    const versions = await getCodeEvaluatorVersions({
      client,
      evaluatorId,
      limit: options.limit,
    });

    writeProgress({
      message: `Found ${versions.length} version(s)`,
      noProgress: !options.progress,
    });

    writeOutput({
      message: formatEvaluatorVersionsOutput({
        versions,
        format: options.format,
      }),
    });
  } catch (error) {
    await exitWithError({
      verb: "fetching evaluator versions",
      error,
      format: options.format,
    });
  }
}

/**
 * Handler for `evaluator version create`
 */
async function evaluatorVersionCreateHandler(
  evaluatorId: string,
  options: EvaluatorVersionCreateOptions
): Promise<void> {
  try {
    const sourceCode = readInlineOrFile({
      inline: options.sourceCode,
      inlineFlag: "--source-code",
      file: options.file,
      fileFlag: "--file",
    });
    const configuration: VersionConfiguration = {
      ...(options.description !== undefined && {
        description: options.description,
      }),
      ...(options.sandboxConfigId !== undefined && {
        sandbox_config_id: options.sandboxConfigId,
      }),
      ...(options.inputMapping !== undefined && {
        input_mapping: parseJsonObjectFlag<InputMapping>({
          flag: "--input-mapping",
          value: options.inputMapping,
        }),
      }),
      ...(options.outputConfigs !== undefined && {
        output_configs: parseJsonArrayFlag<CodeOutputConfig>({
          flag: "--output-configs",
          value: options.outputConfigs,
          nonEmpty: { hint: currentOutputConfigsHint(evaluatorId) },
        }),
      }),
    };

    const client = createClientOrExit(options);

    writeProgress({
      message: `Creating version for evaluator ${evaluatorId}...`,
      noProgress: !options.progress,
    });

    const version = await createCodeEvaluatorVersion({
      client,
      evaluatorId,
      sourceCode,
      expectedCurrentVersionId: options.expectedCurrentVersion,
      configuration,
    });

    writeOutput({
      message: formatEvaluatorVersionOutput({
        version,
        format: options.format,
      }),
    });
  } catch (error) {
    await exitWithError({
      verb: "creating evaluator version",
      error,
      format: options.format,
    });
  }
}

function addCommonReadOptions(command: Command): Command {
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

export function createEvaluatorListCommand(): Command {
  return addCommonReadOptions(
    new Command("list")
      .description(
        "List shared evaluator definitions, newest first. Requires Phoenix server >= 21.0.0."
      )
      .option("--type <type>", "Only one kind of evaluator: llm or code")
      .option("--name <name>", "Only the evaluator with this exact name")
      .option(
        "--limit <number>",
        "Maximum number of evaluators to fetch",
        parsePositiveIntOption
      )
  )
    .addHelpText(
      "after",
      "\nExamples:\n" +
        "  # List every definition\n" +
        "  px evaluator list\n\n" +
        "  # Find one evaluator by name (agent-friendly)\n" +
        "  px evaluator list --name exact-match --format raw --no-progress | jq -r '.[0].id'\n"
    )
    .action(evaluatorListHandler);
}

export function createEvaluatorGetCommand(): Command {
  return addCommonReadOptions(
    new Command("get")
      .description(
        "Show a shared evaluator definition. Requires Phoenix server >= 21.0.0."
      )
      .argument("<evaluator-id>", "Evaluator ID")
  )
    .addHelpText(
      "after",
      "\nExamples:\n" +
        "  # Inspect a definition\n" +
        "  px evaluator get Q29kZUV2YWx1YXRvcjoy\n\n" +
        "  # Print a code evaluator's current source (agent-friendly)\n" +
        "  px evaluator get Q29kZUV2YWx1YXRvcjoy --format raw --no-progress | jq -r '.source_code'\n"
    )
    .action(evaluatorGetHandler);
}

export function createEvaluatorCreateCommand(): Command {
  return addCommonReadOptions(
    new Command("create")
      .description(
        "Create a code evaluator that nothing binds yet, with its first version. Requires Phoenix server >= 21.0.0."
      )
      .option("--name <name>", "Name, unique among evaluators")
      .option("--source-code <text>", "Full source, inline")
      .option("--file <path>", "Read the full source from a file")
      .option("--language <language>", "PYTHON or TYPESCRIPT")
      .option(
        "--sandbox-config-id <id>",
        "Sandbox configuration to run the evaluator in"
      )
      .option(
        "--input-mapping <json>",
        'JSON object with "literal_mapping" and "path_mapping" keys'
      )
      .option("--description <text>", "Description")
      .option(
        "--output-configs <json>",
        "JSON array of output configurations, at least one"
      )
  )
    .addHelpText(
      "after",
      "\nExamples:\n" +
        "  # Create from a file and capture the new evaluator's ID (agent-friendly)\n" +
        "  px evaluator create --name exact-match --file evaluator.py --language PYTHON \\\n" +
        '    --sandbox-config-id U2FuZGJveENvbmZpZzox --input-mapping \'{"literal_mapping":{},"path_mapping":{"output":"output"}}\' \\\n' +
        '    --output-configs \'[{"type":"CONTINUOUS","name":"score","optimization_direction":"MAXIMIZE"}]\' \\\n' +
        "    --format raw --no-progress | jq -r '.id'\n"
    )
    .action(evaluatorCreateHandler);
}

export function createEvaluatorUpdateCommand(): Command {
  return addCommonReadOptions(
    new Command("update")
      .description(
        "Update a shared evaluator definition; the change applies to every project and dataset that uses it. Requires Phoenix server >= 21.0.0."
      )
      .argument("<evaluator-id>", "Evaluator ID")
      .option("--type <type>", "Evaluator type: llm or code")
      .option("--name <name>", "New name for the evaluator")
      .option(
        "--description <text>",
        "New description (LLM evaluators: must equal the prompt tool's description)"
      )
      .option("--clear-description", "Remove the description")
      .option(
        "--output-configs <json>",
        "JSON array of output configurations (LLM evaluators accept categorical configs only)"
      )
      .option(
        "--prompt-version-id <id>",
        "(llm) Run an existing prompt version; create new prompt content through the prompts API first"
      )
      .option(
        "--sandbox-config-id <id>",
        "(code) Sandbox configuration to run the evaluator in"
      )
      .option(
        "--clear-sandbox-config",
        "(code) Detach the sandbox configuration"
      )
      .option(
        "--input-mapping <json>",
        '(code) JSON object with "literal_mapping" and "path_mapping" keys'
      )
  )
    .addHelpText(
      "after",
      "\nExamples:\n" +
        "  # Rename an LLM evaluator\n" +
        "  px evaluator update TExNRXZhbHVhdG9yOjE= --type llm --name toxicity\n\n" +
        "  # Point an LLM evaluator at another version of its prompt\n" +
        "  px evaluator update TExNRXZhbHVhdG9yOjE= --type llm --prompt-version-id UHJvbXB0VmVyc2lvbjo3\n\n" +
        "  # Change how a code evaluator reads its inputs\n" +
        '  px evaluator update Q29kZUV2YWx1YXRvcjoy --type code --input-mapping \'{"literal_mapping":{},"path_mapping":{"output":"output"}}\'\n'
    )
    .action(evaluatorUpdateHandler);
}

export function createEvaluatorDeleteCommand(): Command {
  return new Command("delete")
    .description(
      "Delete a code evaluator that nothing binds, with its version history. Requires Phoenix server >= 21.0.0."
    )
    .argument("<evaluator-id>", "Code evaluator ID")
    .option("--endpoint <url>", "Phoenix API endpoint")
    .option("--api-key <key>", "Phoenix API key for authentication")
    .option("-y, --yes", "Skip confirmation prompt")
    .option("--no-progress", "Disable progress indicators")
    .addHelpText(
      "after",
      "\nExamples:\n" +
        "  # Delete an unbound code evaluator; deletes are gated by PHOENIX_CLI_DANGEROUSLY_ENABLE_DELETES=true\n" +
        "  px evaluator delete Q29kZUV2YWx1YXRvcjoy --yes\n"
    )
    .action(evaluatorDeleteHandler);
}

export function createEvaluatorVersionListCommand(): Command {
  return addCommonReadOptions(
    new Command("list")
      .description(
        "List a code evaluator's versions, newest first. Requires Phoenix server >= 21.0.0."
      )
      .argument("<evaluator-id>", "Code evaluator ID")
      .option(
        "--limit <number>",
        "Maximum number of versions to fetch",
        parsePositiveIntOption
      )
  )
    .addHelpText(
      "after",
      "\nExamples:\n" +
        "  # Show the version history\n" +
        "  px evaluator version list Q29kZUV2YWx1YXRvcjoy\n\n" +
        "  # Print the source of the previous version (agent-friendly)\n" +
        "  px evaluator version list Q29kZUV2YWx1YXRvcjoy --limit 2 --format raw --no-progress | jq -r '.[1].source_code'\n"
    )
    .action(evaluatorVersionListHandler);
}

export function createEvaluatorVersionCreateCommand(): Command {
  return addCommonReadOptions(
    new Command("create")
      .description(
        "Append a new immutable version of a code evaluator's source, optionally with the configuration it needs. Requires Phoenix server >= 21.0.0."
      )
      .argument("<evaluator-id>", "Code evaluator ID")
      .option("--source-code <text>", "Full source of the new version, inline")
      .option(
        "--file <path>",
        "Read the full source of the new version from a file"
      )
      .option(
        "--expected-current-version <id>",
        "Refuse to deploy if another version has been appended since this one was current"
      )
      .option(
        "--description <text>",
        "Description applied together with the new code"
      )
      .option(
        "--sandbox-config-id <id>",
        "Sandbox the new code runs in, applied together with it"
      )
      .option(
        "--input-mapping <json>",
        "Default input mapping for the new code, applied together with it"
      )
      .option(
        "--output-configs <json>",
        "Outputs the new code produces, applied together with it"
      )
  )
    .addHelpText(
      "after",
      "\nExamples:\n" +
        "  # Push a new version from a file\n" +
        "  px evaluator version create Q29kZUV2YWx1YXRvcjoy --file evaluator.py\n\n" +
        "  # Deploy new code with the outputs it now produces, refusing to race another deploy\n" +
        "  px evaluator version create Q29kZUV2YWx1YXRvcjoy --file evaluator.py \\\n" +
        '    --expected-current-version Q29kZUV2YWx1YXRvclZlcnNpb246MQ== --output-configs \'[{"type":"FREEFORM","name":"notes"}]\'\n\n' +
        "  # Capture the new version ID (agent-friendly)\n" +
        "  px evaluator version create Q29kZUV2YWx1YXRvcjoy --file evaluator.py --format raw --no-progress | jq -r '.id'\n"
    )
    .action(evaluatorVersionCreateHandler);
}

export function createEvaluatorVersionCommand(): Command {
  const command = new Command("version");
  command.description("Manage code evaluator versions");
  command.addCommand(createEvaluatorVersionListCommand());
  command.addCommand(createEvaluatorVersionCreateCommand());
  return command;
}

/**
 * Create the `evaluator` command with subcommands
 */
export function createEvaluatorCommand(): Command {
  const command = new Command("evaluator");
  command.description("Manage shared Phoenix evaluator definitions");
  command.addCommand(createEvaluatorListCommand());
  command.addCommand(createEvaluatorGetCommand());
  command.addCommand(createEvaluatorCreateCommand());
  command.addCommand(createEvaluatorUpdateCommand());
  command.addCommand(createEvaluatorDeleteCommand());
  command.addCommand(createEvaluatorVersionCommand());
  return command;
}
