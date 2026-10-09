import { getSandboxConfigs } from "@arizeai/phoenix-client/evaluators";
import { Command } from "commander";

import { createPhoenixClient } from "../client";
import {
  getConfigErrorMessage,
  resolveConfig,
  validateConfig,
} from "../config";
import { ExitCode, exitCodeName, getExitCodeForError } from "../exitCodes";
import { writeError, writeOutput, writeProgress } from "../io";
import { parseFormatOption, parsePositiveIntOption } from "../optionParsers";
import { writeStructuredError } from "../structuredError";
import {
  describeError,
  describeFailure,
  validationHint,
} from "./evaluatorErrors";
import type { OutputFormat } from "./formatEvaluator";
import { formatSandboxConfigsOutput } from "./formatSandboxConfig";
import type { CommonOptions } from "./options";

const LANGUAGES = ["PYTHON", "TYPESCRIPT"] as const;
type Language = (typeof LANGUAGES)[number];

/**
 * Options for `px sandbox-config list`.
 */
interface SandboxConfigListOptions extends CommonOptions<OutputFormat> {
  /**
   * `--language <PYTHON|TYPESCRIPT>`: Return configurations for this language
   * only.
   *
   * @example "PYTHON"
   */
  language?: string;
  /**
   * `--limit <number>`: Maximum number of configurations to fetch.
   *
   * @example 10
   */
  limit?: number;
}

/**
 * Handler for `sandbox-config list`
 */
async function sandboxConfigListHandler(
  options: SandboxConfigListOptions
): Promise<void> {
  if (options.limit !== undefined && Number.isNaN(options.limit)) {
    writeStructuredError({
      format: options.format,
      message: "--limit must be a positive integer",
      code: "INVALID_ARGUMENT",
      hint: "px sandbox-config list --limit 10",
    });
    process.exit(ExitCode.INVALID_ARGUMENT);
  }
  const language = options.language?.toUpperCase();
  if (language !== undefined && !LANGUAGES.includes(language as Language)) {
    writeStructuredError({
      format: options.format,
      message: `Invalid --language: ${options.language}. Expected one of: ${LANGUAGES.join(", ")}`,
      code: "INVALID_ARGUMENT",
      hint: "px sandbox-config list --language PYTHON",
    });
    process.exit(ExitCode.INVALID_ARGUMENT);
  }
  const config = resolveConfig({
    cliOptions: { endpoint: options.endpoint, apiKey: options.apiKey },
  });
  const validation = validateConfig({ config, projectRequired: false });
  if (!validation.valid) {
    writeError({
      message: getConfigErrorMessage({ errors: validation.errors }),
    });
    process.exit(ExitCode.INVALID_ARGUMENT);
  }
  try {
    writeProgress({
      message: "Fetching sandbox configurations...",
      noProgress: !options.progress,
    });
    const configs = await getSandboxConfigs({
      client: createPhoenixClient({ config }),
      language: language as Language | undefined,
      limit: options.limit,
    });
    writeOutput({
      message: formatSandboxConfigsOutput({ configs, format: options.format }),
    });
  } catch (error) {
    const exitCode = getExitCodeForError(error);
    writeStructuredError({
      format: options.format,
      message: `Error fetching sandbox configurations: ${await describeError(error)}`,
      code: exitCodeName(exitCode),
      hint: validationHint(error),
      ...describeFailure(error),
    });
    process.exit(exitCode);
  }
}

export function createSandboxConfigListCommand(): Command {
  return new Command("list")
    .description(
      "List the sandbox configurations code evaluators can run in, newest first. Pass an id as --sandbox-config-id. Requires Phoenix server >= 21.0.0."
    )
    .option(
      "--language <language>",
      "Only configurations for PYTHON or TYPESCRIPT"
    )
    .option(
      "--limit <number>",
      "Maximum number of configurations to fetch",
      parsePositiveIntOption
    )
    .option("--endpoint <url>", "Phoenix API endpoint")
    .option("--api-key <key>", "Phoenix API key for authentication")
    .option(
      "--format <format>",
      "Output format: pretty, json, or raw",
      parseFormatOption,
      "pretty"
    )
    .option("--no-progress", "Disable progress indicators")
    .addHelpText(
      "after",
      "\nExamples:\n" +
        "  px sandbox-config list --language PYTHON\n\n" +
        "  # The id of the first usable Python sandbox (agent-friendly)\n" +
        "  px sandbox-config list --language PYTHON --format raw --no-progress | jq -r 'map(select(.is_usable))[0].id'\n"
    )
    .action(sandboxConfigListHandler);
}

export function createSandboxConfigCommand(): Command {
  const command = new Command("sandbox-config");
  command.description("List sandbox configurations for code evaluators");
  command.addCommand(createSandboxConfigListCommand());
  return command;
}
