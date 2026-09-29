import type { componentsV1, PhoenixClient } from "@arizeai/phoenix-client";
import {
  createProjectEvaluator,
  deleteProjectEvaluator,
  deleteProjectEvaluators,
  getProjectEvaluator,
  getProjectEvaluators,
  updateProjectEvaluator,
} from "@arizeai/phoenix-client/evaluators";
import { Command } from "commander";

import { createPhoenixClient } from "../client";
import {
  getConfigErrorMessage,
  resolveConfig,
  validateConfig,
} from "../config";
import { assertDeletesEnabled, confirmOrExit } from "../confirm";
import { ExitCode, InvalidArgumentError } from "../exitCodes";
import { writeError, writeOutput, writeProgress } from "../io";
import { parseNumberOption, parsePositiveIntOption } from "../optionParsers";
import { writeStructuredError } from "../structuredError";
import { exitWithError, requireValidLimitOrExit } from "./evaluatorErrors";
import {
  parseJsonObjectFlag,
  readInlineOrFile,
  requireCodeEvaluatorOutputConfigs,
} from "./evaluatorInputs";
import {
  formatProjectEvaluatorOutput,
  formatProjectEvaluatorsOutput,
  type OutputFormat,
} from "./formatProjectEvaluator";
import type { CommonOptions, DeleteOptions } from "./options";

type CreateRequest = componentsV1["schemas"]["CreateProjectEvaluatorRequest"];
type PatchRequest = componentsV1["schemas"]["PatchProjectEvaluatorRequest"];
type InputMapping = componentsV1["schemas"]["InputMapping"];
type EvaluatorInput = CreateRequest["evaluator"];
type EvaluationTarget = CreateRequest["evaluation_target"];

const EVALUATION_TARGETS = ["SPAN", "TRACE", "SESSION"] as const;

/**
 * Options for `px project evaluator list <project-identifier>`.
 */
interface ProjectEvaluatorListOptions extends CommonOptions<OutputFormat> {
  /**
   * `--limit <number>`: Maximum number of bindings to fetch. Defaults to
   * fetching every page.
   *
   * @example 50
   */
  limit?: number;
}

/**
 * Options for `px project evaluator get <project-evaluator-id>`.
 */
type ProjectEvaluatorGetOptions = CommonOptions<OutputFormat>;

/**
 * Scheduling flags shared by create and update.
 */
interface ProjectEvaluatorFieldOptions extends CommonOptions<OutputFormat> {
  /**
   * `--name <name>`: The binding's name, unique within the project.
   *
   * @example "toxicity"
   */
  name?: string;
  /**
   * `--sampling-rate <number>`: Fraction of matching records to evaluate,
   * between 0 and 1.
   *
   * @example 0.25
   */
  samplingRate?: number;
  /**
   * `--filter-condition <expr>`: Filter expression records must match, written
   * in the language of the evaluation target (span, trace, or session).
   *
   * @example "span_kind == 'LLM'"
   */
  filterCondition?: string;
  /**
   * `--enabled` / `--disabled`: Whether the binding is active. Commander
   * leaves this undefined when neither flag is passed.
   */
  enabled?: boolean;
  /**
   * `--input-mapping <json>`: JSON object with `literal_mapping` and
   * `path_mapping` keys mapping record fields onto evaluator arguments.
   * Required for a new LLM evaluator; omit it for a code evaluator to use the
   * shared definition's mapping.
   */
  inputMapping?: string;
  /**
   * `--evaluation-delay-seconds <number>`: For TRACE and SESSION targets, how
   * long the trace or session must be quiet before it is evaluated. Defaults
   * to the server's setting for the target. Rejected for SPAN targets, which
   * evaluate spans as they arrive.
   *
   * @example 600
   */
  evaluationDelaySeconds?: number;
}

/**
 * Options for `px project evaluator create <project-identifier>`. Exactly one
 * of `--evaluator-id`, `--evaluator`, or `--evaluator-file` selects the
 * evaluator.
 */
interface ProjectEvaluatorCreateOptions extends ProjectEvaluatorFieldOptions {
  /**
   * `--evaluation-target <SPAN|TRACE|SESSION>`: What the evaluator runs on.
   * Required.
   */
  evaluationTarget?: string;
  /**
   * `--evaluator-id <id>`: Bind an existing code evaluator. LLM evaluators
   * cannot be referenced because each one is tied to its own prompt.
   *
   * @example "Q29kZUV2YWx1YXRvcjoy"
   */
  evaluatorId?: string;
  /**
   * `--evaluator <json>`: Inline JSON for a new LLM or code evaluator, with a
   * `type` of `llm` or `code`. A new LLM evaluator names its prompt source
   * with either `prompt_version` (content for a new prompt) or
   * `prompt_version_id` (an existing version), not both, and its
   * `description` must equal the description of its prompt's tool function.
   * A new code evaluator carries at least one entry in `output_configs`.
   */
  evaluator?: string;
  /**
   * `--evaluator-file <path>`: Read the new evaluator JSON from a file.
   *
   * @example "./toxicity-evaluator.json"
   */
  evaluatorFile?: string;
}

/**
 * Options for `px project evaluator update <project-evaluator-id>`.
 */
interface ProjectEvaluatorUpdateOptions extends ProjectEvaluatorFieldOptions {
  /**
   * `--inherit-input-mapping`: Drop the binding's input mapping and use the
   * shared definition's mapping again. Code evaluators only.
   *
   * @example true
   */
  inheritInputMapping?: boolean;
  /**
   * `--default-evaluation-delay`: Drop the binding's evaluation delay and
   * restore the server's default for its target.
   *
   * @example true
   */
  defaultEvaluationDelay?: boolean;
}

/**
 * Options for `px project evaluator delete <project-evaluator-id...>`.
 */
interface ProjectEvaluatorDeleteOptions extends DeleteOptions {
  /**
   * `--delete-prompt`: Also delete the prompt of an LLM evaluator that is
   * deleted along with the binding. Off by default so that a prompt adopted
   * from the prompt hub survives the binding.
   *
   * @example true
   */
  deletePrompt?: boolean;
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

/**
 * The CLI accepts a project name or ID in one positional argument; the server
 * resolves whichever it is (an ID wins when a project shares its name).
 */
function projectRef(identifier: string): { projectName: string } {
  return { projectName: identifier };
}

/**
 * Handler for `project evaluator list`
 */
/** The server's minimum quiet period for TRACE and SESSION evaluators. */
const MINIMUM_EVALUATION_DELAY_SECONDS = 10;

/**
 * Reject scheduling flags that parsed to something the server would silently
 * reinterpret or reject: a non-finite or out-of-range sampling rate, or a
 * delay that parsed to NaN (zero, negative, fractional, or not a number) or is
 * below the 10-second minimum. NaN would be serialized as null, which the
 * server reads as "use the default".
 */
function requireValidSchedulingOrExit({
  samplingRate,
  evaluationDelaySeconds,
  format,
}: {
  samplingRate: number | undefined;
  evaluationDelaySeconds: number | undefined;
  format?: OutputFormat;
}): void {
  if (
    samplingRate !== undefined &&
    !(Number.isFinite(samplingRate) && samplingRate >= 0 && samplingRate <= 1)
  ) {
    writeStructuredError({
      format,
      message: "--sampling-rate must be a number between 0 and 1",
      code: "INVALID_ARGUMENT",
    });
    process.exit(ExitCode.INVALID_ARGUMENT);
  }
  if (
    evaluationDelaySeconds !== undefined &&
    (Number.isNaN(evaluationDelaySeconds) ||
      evaluationDelaySeconds < MINIMUM_EVALUATION_DELAY_SECONDS)
  ) {
    writeStructuredError({
      format,
      message: `--evaluation-delay-seconds must be an integer of at least ${MINIMUM_EVALUATION_DELAY_SECONDS}`,
      code: "INVALID_ARGUMENT",
    });
    process.exit(ExitCode.INVALID_ARGUMENT);
  }
}

async function projectEvaluatorListHandler(
  projectIdentifier: string,
  options: ProjectEvaluatorListOptions
): Promise<void> {
  requireValidLimitOrExit({ limit: options.limit, format: options.format });

  try {
    const client = createClientOrExit(options);

    writeProgress({
      message: `Fetching evaluators for project "${projectIdentifier}"...`,
      noProgress: !options.progress,
    });

    const bindings = await getProjectEvaluators({
      client,
      project: projectRef(projectIdentifier),
      limit: options.limit,
    });

    writeProgress({
      message: `Found ${bindings.length} project evaluator(s)`,
      noProgress: !options.progress,
    });

    writeOutput({
      message: formatProjectEvaluatorsOutput({
        bindings,
        format: options.format,
      }),
    });
  } catch (error) {
    await exitWithError({
      verb: "fetching project evaluators",
      error,
      format: options.format,
    });
  }
}

/**
 * Handler for `project evaluator get`
 */
async function projectEvaluatorGetHandler(
  projectEvaluatorId: string,
  options: ProjectEvaluatorGetOptions
): Promise<void> {
  try {
    const client = createClientOrExit(options);

    writeProgress({
      message: `Fetching project evaluator ${projectEvaluatorId}...`,
      noProgress: !options.progress,
    });

    const binding = await getProjectEvaluator({ client, projectEvaluatorId });

    writeOutput({
      message: formatProjectEvaluatorOutput({
        binding,
        format: options.format,
      }),
    });
  } catch (error) {
    await exitWithError({
      verb: "fetching project evaluator",
      error,
      format: options.format,
    });
  }
}

/**
 * Resolve the evaluator to bind from whichever flag the caller supplied.
 * Callers validate that exactly one form is present before calling.
 */
function resolveEvaluatorInput(
  options: ProjectEvaluatorCreateOptions
): EvaluatorInput {
  if (options.evaluatorId !== undefined) {
    return { type: "reference", evaluator_id: options.evaluatorId };
  }
  const flag =
    options.evaluator !== undefined ? "--evaluator" : "--evaluator-file";
  const evaluator = parseJsonObjectFlag<EvaluatorInput>({
    flag,
    value: readInlineOrFile({
      inline: options.evaluator,
      inlineFlag: "--evaluator",
      file: options.evaluatorFile,
      fileFlag: "--evaluator-file",
    }),
  });
  requireCodeEvaluatorOutputConfigs({ flag, evaluator });
  return evaluator;
}

/**
 * Handler for `project evaluator create`
 */
async function projectEvaluatorCreateHandler(
  projectIdentifier: string,
  options: ProjectEvaluatorCreateOptions
): Promise<void> {
  // Argument-shape validation runs before the try block so its `process.exit`
  // isn't caught and re-mapped by the catch-all error handler below.
  const usage = `px project evaluator create ${projectIdentifier} --name <name> --evaluation-target SPAN --sampling-rate 1 --evaluator-id <id>`;
  if (!options.name) {
    writeStructuredError({
      format: options.format,
      message: "Missing required flag --name",
      code: "INVALID_ARGUMENT",
      hint: usage,
    });
    process.exit(ExitCode.INVALID_ARGUMENT);
  }
  if (!options.evaluationTarget) {
    writeStructuredError({
      format: options.format,
      message: "Missing required flag --evaluation-target",
      code: "INVALID_ARGUMENT",
      hint: usage,
    });
    process.exit(ExitCode.INVALID_ARGUMENT);
  }
  const evaluationTarget =
    options.evaluationTarget.toUpperCase() as EvaluationTarget;
  if (!EVALUATION_TARGETS.includes(evaluationTarget)) {
    writeStructuredError({
      format: options.format,
      message: `Invalid --evaluation-target '${options.evaluationTarget}'. Must be one of: ${EVALUATION_TARGETS.join(", ")}`,
      code: "INVALID_ARGUMENT",
    });
    process.exit(ExitCode.INVALID_ARGUMENT);
  }
  if (options.samplingRate === undefined) {
    writeStructuredError({
      format: options.format,
      message: "Missing required flag --sampling-rate",
      code: "INVALID_ARGUMENT",
      hint: usage,
    });
    process.exit(ExitCode.INVALID_ARGUMENT);
  }
  const evaluatorFlags = [
    options.evaluatorId,
    options.evaluator,
    options.evaluatorFile,
  ].filter((value) => value !== undefined).length;
  if (evaluatorFlags !== 1) {
    writeStructuredError({
      format: options.format,
      message:
        "Specify exactly one of --evaluator-id, --evaluator, or --evaluator-file",
      code: "INVALID_ARGUMENT",
      hint: usage,
    });
    process.exit(ExitCode.INVALID_ARGUMENT);
  }

  requireValidSchedulingOrExit({
    samplingRate: options.samplingRate,
    evaluationDelaySeconds: options.evaluationDelaySeconds,
    format: options.format,
  });

  if (
    evaluationTarget === "SPAN" &&
    options.evaluationDelaySeconds !== undefined
  ) {
    writeStructuredError({
      format: options.format,
      message:
        "--evaluation-delay-seconds is not accepted for SPAN evaluators, which evaluate spans as they arrive",
      code: "INVALID_ARGUMENT",
      hint: usage,
    });
    process.exit(ExitCode.INVALID_ARGUMENT);
  }

  try {
    const inputMapping =
      options.inputMapping === undefined
        ? undefined
        : parseJsonObjectFlag<InputMapping>({
            flag: "--input-mapping",
            value: options.inputMapping,
          });

    const evaluator = resolveEvaluatorInput(options);
    if (evaluator.type === "llm" && inputMapping === undefined) {
      throw new InvalidArgumentError(
        "--input-mapping is required when --evaluator or --evaluator-file creates an LLM evaluator"
      );
    }

    const client = createClientOrExit(options);

    writeProgress({
      message: `Binding evaluator to project "${projectIdentifier}"...`,
      noProgress: !options.progress,
    });

    const binding = await createProjectEvaluator({
      client,
      project: projectRef(projectIdentifier),
      name: options.name,
      evaluationTarget,
      samplingRate: options.samplingRate,
      evaluator,
      ...(options.filterCondition !== undefined && {
        filterCondition: options.filterCondition,
      }),
      ...(options.enabled !== undefined && { enabled: options.enabled }),
      ...(inputMapping !== undefined && { inputMapping }),
      ...(options.evaluationDelaySeconds !== undefined && {
        evaluationDelaySeconds: options.evaluationDelaySeconds,
      }),
    });

    writeOutput({
      message: formatProjectEvaluatorOutput({
        binding,
        format: options.format,
      }),
    });
  } catch (error) {
    await exitWithError({
      verb: "creating project evaluator",
      error,
      format: options.format,
    });
  }
}

/**
 * Handler for `project evaluator update`
 */
async function projectEvaluatorUpdateHandler(
  projectEvaluatorId: string,
  options: ProjectEvaluatorUpdateOptions
): Promise<void> {
  // Argument-shape validation runs before the try block so its `process.exit`
  // isn't caught and re-mapped by the catch-all error handler below.
  const fieldFlags = [
    options.name,
    options.samplingRate,
    options.filterCondition,
    options.enabled,
    options.inputMapping,
    options.evaluationDelaySeconds,
    options.inheritInputMapping,
    options.defaultEvaluationDelay,
  ];
  if (fieldFlags.every((value) => value === undefined)) {
    writeStructuredError({
      format: options.format,
      message: "Nothing to update: pass at least one field flag",
      code: "INVALID_ARGUMENT",
      hint: `px project evaluator update ${projectEvaluatorId} --disabled`,
    });
    process.exit(ExitCode.INVALID_ARGUMENT);
  }
  const contradictions: Array<[string, string, boolean]> = [
    [
      "--input-mapping",
      "--inherit-input-mapping",
      options.inputMapping !== undefined &&
        Boolean(options.inheritInputMapping),
    ],
    [
      "--evaluation-delay-seconds",
      "--default-evaluation-delay",
      options.evaluationDelaySeconds !== undefined &&
        Boolean(options.defaultEvaluationDelay),
    ],
  ];
  for (const [setFlag, resetFlag, both] of contradictions) {
    if (both) {
      writeStructuredError({
        format: options.format,
        message: `Specify either ${setFlag} or ${resetFlag}, not both`,
        code: "INVALID_ARGUMENT",
      });
      process.exit(ExitCode.INVALID_ARGUMENT);
    }
  }

  requireValidSchedulingOrExit({
    samplingRate: options.samplingRate,
    evaluationDelaySeconds: options.evaluationDelaySeconds,
    format: options.format,
  });

  try {
    const body: PatchRequest = {};
    if (options.name !== undefined) {
      body.name = options.name;
    }
    if (options.samplingRate !== undefined) {
      body.sampling_rate = options.samplingRate;
    }
    if (options.filterCondition !== undefined) {
      body.filter_condition = options.filterCondition;
    }
    if (options.enabled !== undefined) {
      body.enabled = options.enabled;
    }
    if (options.inputMapping !== undefined) {
      body.input_mapping = parseJsonObjectFlag<InputMapping>({
        flag: "--input-mapping",
        value: options.inputMapping,
      });
    }
    if (options.inheritInputMapping) {
      body.input_mapping = null;
    }
    if (options.evaluationDelaySeconds !== undefined) {
      body.evaluation_delay_seconds = options.evaluationDelaySeconds;
    }
    if (options.defaultEvaluationDelay) {
      body.evaluation_delay_seconds = null;
    }

    const client = createClientOrExit(options);

    writeProgress({
      message: `Updating project evaluator ${projectEvaluatorId}...`,
      noProgress: !options.progress,
    });

    const binding = await updateProjectEvaluator({
      client,
      projectEvaluatorId,
      patch: body,
    });

    writeOutput({
      message: formatProjectEvaluatorOutput({
        binding,
        format: options.format,
      }),
    });
  } catch (error) {
    await exitWithError({
      verb: "updating project evaluator",
      error,
      format: options.format,
    });
  }
}

/**
 * Handler for `project evaluator delete`
 */
async function projectEvaluatorDeleteHandler(
  projectEvaluatorIds: string[],
  options: ProjectEvaluatorDeleteOptions
): Promise<void> {
  try {
    assertDeletesEnabled();

    const client = createClientOrExit(options);

    const noun =
      projectEvaluatorIds.length === 1
        ? `project evaluator ${projectEvaluatorIds[0]}`
        : `${projectEvaluatorIds.length} project evaluators`;
    await confirmOrExit({
      message: `Delete ${noun}? This removes the binding and its evaluator traces, and the evaluator itself if nothing else uses it. This cannot be undone.`,
      yes: options.yes,
    });

    const deleteAssociatedPrompt = Boolean(options.deletePrompt);
    if (projectEvaluatorIds.length === 1) {
      await deleteProjectEvaluator({
        client,
        projectEvaluatorId: projectEvaluatorIds[0]!,
        deleteAssociatedPrompt,
      });
    } else {
      await deleteProjectEvaluators({
        client,
        projectEvaluatorIds,
        deleteAssociatedPrompt,
      });
    }

    writeProgress({
      message: `Deleted ${noun}`,
      noProgress: !options.progress,
    });
  } catch (error) {
    await exitWithError({ verb: "deleting project evaluator", error });
  }
}

function addSchedulingOptions(command: Command): Command {
  const creating = command.name() === "create";
  return command
    .option("--name <name>", "Binding name, unique within the project")
    .option(
      "--sampling-rate <number>",
      "Fraction of matching records to evaluate, between 0 and 1",
      parseNumberOption
    )
    .option(
      "--filter-condition <expr>",
      creating
        ? "Filter expression records must match, in the language of --evaluation-target"
        : "Filter expression records must match, in the language of the binding's evaluation target"
    )
    .option("--enabled", "Activate the binding")
    .option("--disabled", "Deactivate the binding without deleting it")
    .option(
      "--input-mapping <json>",
      creating
        ? 'JSON object with "literal_mapping" and "path_mapping" keys (required for a new LLM evaluator; omit for code to use the definition\'s)'
        : 'JSON object with "literal_mapping" and "path_mapping" keys that replaces the binding\'s mapping'
    )
    .option(
      "--evaluation-delay-seconds <number>",
      creating
        ? "For TRACE and SESSION targets, quiet period before the trace or session is evaluated (rejected for SPAN)"
        : "For TRACE and SESSION bindings, quiet period before the trace or session is evaluated (SPAN bindings reject it)",
      parsePositiveIntOption
    );
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

/**
 * Commander stores `--enabled` and `--disabled` as two booleans. Collapse them
 * into the single `enabled` field the handlers read, rejecting both at once.
 */
function collapseEnabledFlags(
  options: ProjectEvaluatorFieldOptions & { disabled?: boolean }
): void {
  if (options.enabled && options.disabled) {
    writeStructuredError({
      format: options.format,
      message: "--enabled and --disabled cannot be used together",
      code: "INVALID_ARGUMENT",
    });
    process.exit(ExitCode.INVALID_ARGUMENT);
  }
  if (options.disabled) {
    options.enabled = false;
  }
  delete options.disabled;
}

export function createProjectEvaluatorListCommand(): Command {
  return addCommonReadOptions(
    new Command("list")
      .description(
        "List the evaluators bound to a project. Requires Phoenix server >= 21.0.0."
      )
      .argument("<project-identifier>", "Project name or ID")
      .option(
        "--limit <number>",
        "Maximum number of bindings to fetch",
        parsePositiveIntOption
      )
  )
    .addHelpText(
      "after",
      "\nExamples:\n" +
        "  px project evaluator list support-bot\n" +
        "  px project evaluator list support-bot --format raw --no-progress | jq -r '.[] | select(.enabled) | .id'\n"
    )
    .action(projectEvaluatorListHandler);
}

export function createProjectEvaluatorGetCommand(): Command {
  return addCommonReadOptions(
    new Command("get")
      .description(
        "Show a project evaluator binding. Requires Phoenix server >= 21.0.0."
      )
      .argument("<project-evaluator-id>", "Project evaluator ID")
      .addHelpText(
        "after",
        "\nExamples:\n" +
          "  # Inspect a binding\n" +
          "  px project evaluator get UHJvamVjdEV2YWx1YXRvcjox --format raw --no-progress\n"
      )
  ).action(projectEvaluatorGetHandler);
}

export function createProjectEvaluatorCreateCommand(): Command {
  return addCommonReadOptions(
    addSchedulingOptions(
      new Command("create")
        .description(
          "Bind an evaluator to a project so it runs on incoming traces, creating the evaluator if needed. Requires Phoenix server >= 21.0.0."
        )
        .argument("<project-identifier>", "Project name or ID")
        .option(
          "--evaluation-target <target>",
          "What the evaluator runs on: SPAN, TRACE, or SESSION"
        )
        .option(
          "--evaluator-id <id>",
          "Bind an existing code evaluator (LLM evaluators are created with the binding)"
        )
        .option(
          "--evaluator <json>",
          'Inline JSON for a new evaluator with "type": "llm" or "code" (LLM: give "prompt_version" or "prompt_version_id", not both; code: at least one "output_configs" entry)'
        )
        .option(
          "--evaluator-file <path>",
          "Read the new evaluator JSON from a file"
        )
    )
  )
    .addHelpText(
      "after",
      "\nExamples:\n" +
        "  # Evaluate a quarter of LLM spans with an existing evaluator\n" +
        "  px project evaluator create support-bot --name toxicity --evaluation-target SPAN --sampling-rate 0.25 --evaluator-id Q29kZUV2YWx1YXRvcjox --filter-condition \"span_kind == 'LLM'\"\n\n" +
        "  # Evaluate whole sessions ten minutes after they go quiet\n" +
        '  px project evaluator create support-bot --name resolution --evaluation-target SESSION --sampling-rate 1 --evaluator-file resolution.json --input-mapping \'{"literal_mapping":{},"path_mapping":{"output":"output"}}\' --evaluation-delay-seconds 600\n\n' +
        "  # Capture the new binding ID (agent-friendly)\n" +
        "  px project evaluator create support-bot --name toxicity --evaluation-target SPAN --sampling-rate 1 --evaluator-id Q29kZUV2YWx1YXRvcjox --format raw --no-progress | jq -r '.id'\n"
    )
    .action(
      (
        projectIdentifier: string,
        options: ProjectEvaluatorCreateOptions & { disabled?: boolean }
      ) => {
        collapseEnabledFlags(options);
        return projectEvaluatorCreateHandler(projectIdentifier, options);
      }
    );
}

export function createProjectEvaluatorUpdateCommand(): Command {
  return addCommonReadOptions(
    addSchedulingOptions(
      new Command("update")
        .description(
          "Update a project evaluator binding; only the flags you pass are changed. Requires Phoenix server >= 21.0.0."
        )
        .argument("<project-evaluator-id>", "Project evaluator ID")
        .option(
          "--inherit-input-mapping",
          "Drop the binding's input mapping and use the definition's (code evaluators)"
        )
        .option(
          "--default-evaluation-delay",
          "Drop the binding's evaluation delay and restore the server default"
        )
    )
  )
    .addHelpText(
      "after",
      "\nExamples:\n" +
        "  # Pause a binding without deleting it\n" +
        "  px project evaluator update UHJvamVjdEV2YWx1YXRvcjox --disabled\n\n" +
        "  # Sample more traffic\n" +
        "  px project evaluator update UHJvamVjdEV2YWx1YXRvcjox --sampling-rate 0.5\n\n" +
        "  # Go back to the server's default quiet period\n" +
        "  px project evaluator update UHJvamVjdEV2YWx1YXRvcjox --default-evaluation-delay\n"
    )
    .action(
      (
        projectEvaluatorId: string,
        options: ProjectEvaluatorUpdateOptions & { disabled?: boolean }
      ) => {
        collapseEnabledFlags(options);
        return projectEvaluatorUpdateHandler(projectEvaluatorId, options);
      }
    );
}

export function createProjectEvaluatorDeleteCommand(): Command {
  return new Command("delete")
    .description(
      "Delete one or more project evaluator bindings, and their evaluators once nothing else uses them. Requires Phoenix server >= 21.0.0."
    )
    .argument("<project-evaluator-id...>", "Project evaluator ID(s)")
    .option(
      "--delete-prompt",
      "Also delete the prompt of an LLM evaluator deleted with the binding"
    )
    .option("--endpoint <url>", "Phoenix API endpoint")
    .option("--api-key <key>", "Phoenix API key for authentication")
    .option("-y, --yes", "Skip confirmation prompt")
    .option("--no-progress", "Disable progress indicators")
    .addHelpText(
      "after",
      "\nExamples:\n" +
        "  # Detach one binding; deletes are gated by PHOENIX_CLI_DANGEROUSLY_ENABLE_DELETES=true\n" +
        "  px project evaluator delete UHJvamVjdEV2YWx1YXRvcjox --yes\n\n" +
        "  # Detach several and also drop an LLM evaluator's prompt\n" +
        "  px project evaluator delete UHJvamVjdEV2YWx1YXRvcjox UHJvamVjdEV2YWx1YXRvcjoy --delete-prompt --yes\n"
    )
    .action(projectEvaluatorDeleteHandler);
}

/**
 * Create the `project evaluator` command with subcommands
 */
export function createProjectEvaluatorCommand(): Command {
  const command = new Command("evaluator");
  command.description("Manage evaluators that run on a project's traces");
  command.addCommand(createProjectEvaluatorListCommand());
  command.addCommand(createProjectEvaluatorGetCommand());
  command.addCommand(createProjectEvaluatorCreateCommand());
  command.addCommand(createProjectEvaluatorUpdateCommand());
  command.addCommand(createProjectEvaluatorDeleteCommand());
  return command;
}
