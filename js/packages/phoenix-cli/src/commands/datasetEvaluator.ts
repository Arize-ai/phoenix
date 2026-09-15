import type { componentsV1, PhoenixClient } from "@arizeai/phoenix-client";
import {
  createDatasetEvaluator,
  deleteDatasetEvaluator,
  deleteDatasetEvaluators,
  getDatasetEvaluator,
  getDatasetEvaluators,
  updateDatasetEvaluator,
} from "@arizeai/phoenix-client/evaluators";
import { Command } from "commander";

import { createPhoenixClient } from "../client";
import {
  getConfigErrorMessage,
  resolveConfig,
  validateConfig,
} from "../config";
import { assertDeletesEnabled, confirmOrExit } from "../confirm";
import { ExitCode } from "../exitCodes";
import { writeError, writeOutput, writeProgress } from "../io";
import { parsePositiveIntOption } from "../optionParsers";
import { writeStructuredError } from "../structuredError";
import { exitWithError, requireValidLimitOrExit } from "./evaluatorErrors";
import {
  parseJsonArrayFlag,
  parseJsonObjectFlag,
  readInlineOrFile,
  requireCodeEvaluatorOutputConfigs,
} from "./evaluatorInputs";
import {
  formatDatasetEvaluatorOutput,
  formatDatasetEvaluatorsOutput,
  type OutputFormat,
} from "./formatDatasetEvaluator";
import type { CommonOptions, DeleteOptions } from "./options";

type CreateRequest = componentsV1["schemas"]["CreateDatasetEvaluatorRequest"];
type PatchRequest = componentsV1["schemas"]["PatchDatasetEvaluatorRequest"];
type InputMapping = componentsV1["schemas"]["InputMapping"];
type OutputConfig = NonNullable<CreateRequest["output_configs"]>[number];
type EvaluatorInput = CreateRequest["evaluator"];

/**
 * Options for `px dataset evaluator list <dataset-identifier>`.
 */
interface DatasetEvaluatorListOptions extends CommonOptions<OutputFormat> {
  /**
   * `--limit <number>`: Maximum number of bindings to fetch. Defaults to
   * fetching every page.
   *
   * @example 50
   */
  limit?: number;
}

/**
 * Options for `px dataset evaluator get <dataset-evaluator-id>`.
 */
type DatasetEvaluatorGetOptions = CommonOptions<OutputFormat>;

/**
 * Flags shared by create and update for the binding's own fields.
 */
interface DatasetEvaluatorFieldOptions extends CommonOptions<OutputFormat> {
  /**
   * `--name <name>`: The binding's name, unique within the dataset.
   *
   * @example "exact-match"
   */
  name?: string;
  /**
   * `--description <text>`: Overrides the shared definition's description on
   * this binding. For LLM evaluators it must equal the description of the
   * prompt's tool function.
   */
  description?: string;
  /**
   * `--input-mapping <json>`: JSON object with `literal_mapping` and
   * `path_mapping` keys mapping example and run fields onto evaluator
   * arguments.
   *
   * @example '{"literal_mapping":{},"path_mapping":{"output":"output"}}'
   */
  inputMapping?: string;
  /**
   * `--output-configs <json>`: JSON array of at least one output
   * configuration that overrides the shared definition's on this binding. For
   * LLM evaluators they must match the prompt's tool schema.
   */
  outputConfigs?: string;
}

/**
 * Options for `px dataset evaluator create <dataset-identifier>`. Exactly one
 * of `--evaluator-id`, `--evaluator`, or `--evaluator-file` selects the
 * evaluator.
 */
interface DatasetEvaluatorCreateOptions extends DatasetEvaluatorFieldOptions {
  /**
   * `--evaluator-id <id>`: Bind an existing code or built-in evaluator.
   *
   * @example "Q29kZUV2YWx1YXRvcjoy"
   */
  evaluatorId?: string;
  /**
   * `--evaluator <json>`: Inline JSON for a new LLM or code evaluator, with a
   * `type` of `llm` or `code`. A new LLM evaluator names its prompt source
   * with either `prompt_version` (content for a new prompt) or
   * `prompt_version_id` (an existing version), not both. A new code evaluator
   * carries at least one entry in `output_configs`.
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
 * Options for `px dataset evaluator update <dataset-evaluator-id>`.
 */
interface DatasetEvaluatorUpdateOptions extends DatasetEvaluatorFieldOptions {
  /**
   * `--inherit-description`: Drop the binding's description override and
   * inherit the shared definition's description again.
   *
   * @example true
   */
  inheritDescription?: boolean;
  /**
   * `--inherit-output-configs`: Drop the binding's output configuration
   * overrides and inherit the shared definition's outputs again.
   *
   * @example true
   */
  inheritOutputConfigs?: boolean;
}

/**
 * Options for `px dataset evaluator delete <dataset-evaluator-id...>`.
 */
interface DatasetEvaluatorDeleteOptions extends DeleteOptions {
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
 * The CLI accepts a dataset name or ID in one positional argument; the server
 * resolves whichever it is (an ID wins when a dataset shares its name).
 */
function datasetRef(identifier: string): { datasetName: string } {
  return { datasetName: identifier };
}

/**
 * Handler for `dataset evaluator list`
 */
async function datasetEvaluatorListHandler(
  datasetIdentifier: string,
  options: DatasetEvaluatorListOptions
): Promise<void> {
  requireValidLimitOrExit({ limit: options.limit, format: options.format });

  try {
    const client = createClientOrExit(options);

    writeProgress({
      message: `Fetching evaluators for dataset "${datasetIdentifier}"...`,
      noProgress: !options.progress,
    });

    const bindings = await getDatasetEvaluators({
      client,
      dataset: datasetRef(datasetIdentifier),
      limit: options.limit,
    });

    writeProgress({
      message: `Found ${bindings.length} dataset evaluator(s)`,
      noProgress: !options.progress,
    });

    writeOutput({
      message: formatDatasetEvaluatorsOutput({
        bindings,
        format: options.format,
      }),
    });
  } catch (error) {
    await exitWithError({
      verb: "fetching dataset evaluators",
      error,
      format: options.format,
    });
  }
}

/**
 * Handler for `dataset evaluator get`
 */
async function datasetEvaluatorGetHandler(
  datasetEvaluatorId: string,
  options: DatasetEvaluatorGetOptions
): Promise<void> {
  try {
    const client = createClientOrExit(options);

    writeProgress({
      message: `Fetching dataset evaluator ${datasetEvaluatorId}...`,
      noProgress: !options.progress,
    });

    const binding = await getDatasetEvaluator({ client, datasetEvaluatorId });

    writeOutput({
      message: formatDatasetEvaluatorOutput({
        binding,
        format: options.format,
      }),
    });
  } catch (error) {
    await exitWithError({
      verb: "fetching dataset evaluator",
      error,
      format: options.format,
    });
  }
}

/**
 * Resolve the evaluator to bind from whichever flag the caller supplied.
 * Exactly one of the three forms must be present.
 */
function resolveEvaluatorInput(
  options: DatasetEvaluatorCreateOptions
): EvaluatorInput | undefined {
  const supplied = [
    options.evaluatorId,
    options.evaluator,
    options.evaluatorFile,
  ].filter((value) => value !== undefined).length;
  if (supplied !== 1) {
    return undefined;
  }
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
 * Handler for `dataset evaluator create`
 */
async function datasetEvaluatorCreateHandler(
  datasetIdentifier: string,
  options: DatasetEvaluatorCreateOptions
): Promise<void> {
  // Argument-shape validation runs before the try block so its `process.exit`
  // isn't caught and re-mapped by the catch-all error handler below.
  if (!options.name) {
    writeStructuredError({
      format: options.format,
      message: "Missing required flag --name",
      code: "INVALID_ARGUMENT",
      hint: `px dataset evaluator create ${datasetIdentifier} --name <name> --input-mapping <json> --evaluator-id <id>`,
    });
    process.exit(ExitCode.INVALID_ARGUMENT);
  }
  if (!options.inputMapping) {
    writeStructuredError({
      format: options.format,
      message: "Missing required flag --input-mapping",
      code: "INVALID_ARGUMENT",
      hint: `px dataset evaluator create ${datasetIdentifier} --name ${options.name} --input-mapping '{"literal_mapping":{},"path_mapping":{"output":"output"}}' --evaluator-id <id>`,
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
      hint: `px dataset evaluator create ${datasetIdentifier} --name ${options.name} --input-mapping <json> --evaluator-id <id>`,
    });
    process.exit(ExitCode.INVALID_ARGUMENT);
  }

  try {
    const evaluator = resolveEvaluatorInput(options);
    if (evaluator === undefined) {
      throw new Error("Could not resolve the evaluator to bind");
    }
    const inputMapping = parseJsonObjectFlag<InputMapping>({
      flag: "--input-mapping",
      value: options.inputMapping,
    });
    const outputConfigs =
      options.outputConfigs === undefined
        ? undefined
        : parseJsonArrayFlag<OutputConfig>({
            flag: "--output-configs",
            value: options.outputConfigs,
            nonEmpty: {
              hint: `px dataset evaluator create ${datasetIdentifier} --name ${options.name} --input-mapping <json> --evaluator-id <id>`,
            },
          });

    const client = createClientOrExit(options);

    writeProgress({
      message: `Binding evaluator to dataset "${datasetIdentifier}"...`,
      noProgress: !options.progress,
    });

    const binding = await createDatasetEvaluator({
      client,
      dataset: datasetRef(datasetIdentifier),
      name: options.name,
      inputMapping,
      evaluator,
      ...(options.description !== undefined && {
        description: options.description,
      }),
      ...(outputConfigs !== undefined && { outputConfigs }),
    });

    writeOutput({
      message: formatDatasetEvaluatorOutput({
        binding,
        format: options.format,
      }),
    });
  } catch (error) {
    await exitWithError({
      verb: "creating dataset evaluator",
      error,
      format: options.format,
    });
  }
}

/**
 * Handler for `dataset evaluator update`
 */
async function datasetEvaluatorUpdateHandler(
  datasetEvaluatorId: string,
  options: DatasetEvaluatorUpdateOptions
): Promise<void> {
  // Argument-shape validation runs before the try block so its `process.exit`
  // isn't caught and re-mapped by the catch-all error handler below.
  const fieldFlags = [
    options.name,
    options.description,
    options.inputMapping,
    options.outputConfigs,
    options.inheritDescription,
    options.inheritOutputConfigs,
  ];
  if (fieldFlags.every((value) => value === undefined)) {
    writeStructuredError({
      format: options.format,
      message: "Nothing to update: pass at least one field flag",
      code: "INVALID_ARGUMENT",
      hint: `px dataset evaluator update ${datasetEvaluatorId} --name <name>`,
    });
    process.exit(ExitCode.INVALID_ARGUMENT);
  }
  const contradictions: Array<[string, string, boolean]> = [
    [
      "--description",
      "--inherit-description",
      options.description !== undefined && Boolean(options.inheritDescription),
    ],
    [
      "--output-configs",
      "--inherit-output-configs",
      options.outputConfigs !== undefined &&
        Boolean(options.inheritOutputConfigs),
    ],
  ];
  for (const [setFlag, inheritFlag, both] of contradictions) {
    if (both) {
      writeStructuredError({
        format: options.format,
        message: `Specify either ${setFlag} or ${inheritFlag}, not both`,
        code: "INVALID_ARGUMENT",
      });
      process.exit(ExitCode.INVALID_ARGUMENT);
    }
  }

  try {
    const body: PatchRequest = {};
    if (options.name !== undefined) {
      body.name = options.name;
    }
    if (options.description !== undefined) {
      body.description = options.description;
    }
    if (options.inheritDescription) {
      body.description = null;
    }
    if (options.inputMapping !== undefined) {
      body.input_mapping = parseJsonObjectFlag<InputMapping>({
        flag: "--input-mapping",
        value: options.inputMapping,
      });
    }
    if (options.outputConfigs !== undefined) {
      body.output_configs = parseJsonArrayFlag<OutputConfig>({
        flag: "--output-configs",
        value: options.outputConfigs,
        nonEmpty: {
          hint: `px dataset evaluator update ${datasetEvaluatorId} --inherit-output-configs`,
        },
      });
    }
    if (options.inheritOutputConfigs) {
      body.output_configs = null;
    }

    const client = createClientOrExit(options);

    writeProgress({
      message: `Updating dataset evaluator ${datasetEvaluatorId}...`,
      noProgress: !options.progress,
    });

    const binding = await updateDatasetEvaluator({
      client,
      datasetEvaluatorId,
      patch: body,
    });

    writeOutput({
      message: formatDatasetEvaluatorOutput({
        binding,
        format: options.format,
      }),
    });
  } catch (error) {
    await exitWithError({
      verb: "updating dataset evaluator",
      error,
      format: options.format,
    });
  }
}

/**
 * Handler for `dataset evaluator delete`
 */
async function datasetEvaluatorDeleteHandler(
  datasetEvaluatorIds: string[],
  options: DatasetEvaluatorDeleteOptions
): Promise<void> {
  try {
    assertDeletesEnabled();

    const client = createClientOrExit(options);

    const noun =
      datasetEvaluatorIds.length === 1
        ? `dataset evaluator ${datasetEvaluatorIds[0]}`
        : `${datasetEvaluatorIds.length} dataset evaluators`;
    await confirmOrExit({
      message: `Delete ${noun}? This removes the binding and its evaluator traces, and the evaluator itself if nothing else uses it. This cannot be undone.`,
      yes: options.yes,
    });

    const deleteAssociatedPrompt = Boolean(options.deletePrompt);
    if (datasetEvaluatorIds.length === 1) {
      await deleteDatasetEvaluator({
        client,
        datasetEvaluatorId: datasetEvaluatorIds[0]!,
        deleteAssociatedPrompt,
      });
    } else {
      await deleteDatasetEvaluators({
        client,
        datasetEvaluatorIds,
        deleteAssociatedPrompt,
      });
    }

    writeProgress({
      message: `Deleted ${noun}`,
      noProgress: !options.progress,
    });
  } catch (error) {
    await exitWithError({ verb: "deleting dataset evaluator", error });
  }
}

function addBindingFieldOptions(command: Command): Command {
  return command
    .option("--name <name>", "Binding name, unique within the dataset")
    .option(
      "--description <text>",
      "Description override for this binding; for LLM evaluators it must equal the prompt tool's description"
    )
    .option(
      "--input-mapping <json>",
      'JSON object with "literal_mapping" and "path_mapping" keys'
    )
    .option(
      "--output-configs <json>",
      "JSON array of at least one output configuration that overrides the definition's (LLM evaluators: must match the prompt's tool schema)"
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

export function createDatasetEvaluatorListCommand(): Command {
  return addCommonReadOptions(
    new Command("list")
      .description(
        "List the evaluators bound to a dataset. Requires Phoenix server >= 21.0.0."
      )
      .argument("<dataset-identifier>", "Dataset name or ID")
      .option(
        "--limit <number>",
        "Maximum number of bindings to fetch",
        parsePositiveIntOption
      )
  )
    .addHelpText(
      "after",
      "\nExamples:\n" +
        "  px dataset evaluator list golden-questions\n" +
        "  px dataset evaluator list golden-questions --format raw --no-progress | jq -r '.[].id'\n"
    )
    .action(datasetEvaluatorListHandler);
}

export function createDatasetEvaluatorGetCommand(): Command {
  return addCommonReadOptions(
    new Command("get")
      .description(
        "Show a dataset evaluator binding. Requires Phoenix server >= 21.0.0."
      )
      .argument("<dataset-evaluator-id>", "Dataset evaluator ID")
      .addHelpText(
        "after",
        "\nExamples:\n" +
          "  # Inspect a binding\n" +
          "  px dataset evaluator get RGF0YXNldEV2YWx1YXRvcjox --format raw --no-progress\n"
      )
  ).action(datasetEvaluatorGetHandler);
}

export function createDatasetEvaluatorCreateCommand(): Command {
  return addCommonReadOptions(
    addBindingFieldOptions(
      new Command("create")
        .description(
          "Bind an evaluator to a dataset, creating the evaluator if needed. Requires Phoenix server >= 21.0.0."
        )
        .argument("<dataset-identifier>", "Dataset name or ID")
        .option(
          "--evaluator-id <id>",
          "Bind an existing code or built-in evaluator"
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
        "  # Bind an existing evaluator\n" +
        '  px dataset evaluator create golden-questions --name exact-match --evaluator-id Q29kZUV2YWx1YXRvcjoy --input-mapping \'{"literal_mapping":{},"path_mapping":{"output":"output"}}\'\n\n' +
        "  # Create a new LLM evaluator from a JSON file and bind it\n" +
        '  px dataset evaluator create golden-questions --name toxicity --evaluator-file toxicity.json --input-mapping \'{"literal_mapping":{},"path_mapping":{"output":"output"}}\'\n\n' +
        "  # Capture the new binding ID (agent-friendly)\n" +
        "  px dataset evaluator create golden-questions --name exact-match --evaluator-id Q29kZUV2YWx1YXRvcjoy --input-mapping '{\"literal_mapping\":{},\"path_mapping\":{}}' --format raw --no-progress | jq -r '.id'\n"
    )
    .action(datasetEvaluatorCreateHandler);
}

export function createDatasetEvaluatorUpdateCommand(): Command {
  return addCommonReadOptions(
    addBindingFieldOptions(
      new Command("update")
        .description(
          "Update a dataset evaluator binding; only the flags you pass are changed. Requires Phoenix server >= 21.0.0."
        )
        .argument("<dataset-evaluator-id>", "Dataset evaluator ID")
        .option(
          "--inherit-description",
          "Drop the description override and inherit the definition's"
        )
        .option(
          "--inherit-output-configs",
          "Drop the output configuration overrides and inherit the definition's"
        )
    )
  )
    .addHelpText(
      "after",
      "\nExamples:\n" +
        "  px dataset evaluator update RGF0YXNldEV2YWx1YXRvcjox --description 'Runs against the nightly golden set'\n" +
        '  px dataset evaluator update RGF0YXNldEV2YWx1YXRvcjox --input-mapping \'{"literal_mapping":{},"path_mapping":{"output":"output.text"}}\'\n' +
        "  px dataset evaluator update RGF0YXNldEV2YWx1YXRvcjox --inherit-output-configs\n"
    )
    .action(datasetEvaluatorUpdateHandler);
}

export function createDatasetEvaluatorDeleteCommand(): Command {
  return new Command("delete")
    .description(
      "Delete one or more dataset evaluator bindings, and their evaluators once nothing else uses them. Requires Phoenix server >= 21.0.0."
    )
    .argument("<dataset-evaluator-id...>", "Dataset evaluator ID(s)")
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
        "  px dataset evaluator delete RGF0YXNldEV2YWx1YXRvcjox --yes\n\n" +
        "  # Detach several and also drop an LLM evaluator's prompt\n" +
        "  px dataset evaluator delete RGF0YXNldEV2YWx1YXRvcjox RGF0YXNldEV2YWx1YXRvcjoy --delete-prompt --yes\n"
    )
    .action(datasetEvaluatorDeleteHandler);
}

/**
 * Create the `dataset evaluator` command with subcommands
 */
export function createDatasetEvaluatorCommand(): Command {
  const command = new Command("evaluator");
  command.description("Manage evaluators bound to a dataset");
  command.addCommand(createDatasetEvaluatorListCommand());
  command.addCommand(createDatasetEvaluatorGetCommand());
  command.addCommand(createDatasetEvaluatorCreateCommand());
  command.addCommand(createDatasetEvaluatorUpdateCommand());
  command.addCommand(createDatasetEvaluatorDeleteCommand());
  return command;
}
