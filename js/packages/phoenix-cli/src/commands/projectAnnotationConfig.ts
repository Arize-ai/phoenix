import { HttpError } from "@arizeai/phoenix-client";
import {
  assignProjectAnnotationConfig,
  listProjectAnnotationConfigs,
  setProjectAnnotationConfigs,
  unassignProjectAnnotationConfig,
} from "@arizeai/phoenix-client/projects";
import { Command } from "commander";

import { createPhoenixClient } from "../client";
import {
  getConfigErrorMessage,
  resolveConfig,
  validateConfig,
} from "../config";
import { confirmOrExit } from "../confirm";
import { ExitCode, getExitCodeForError } from "../exitCodes";
import { writeError, writeOutput, writeProgress } from "../io";
import { writeStructuredError } from "../structuredError";
import { fetchAnnotationConfigs } from "./annotationConfig";
import {
  formatAnnotationConfigOutput,
  formatAnnotationConfigsOutput,
  formatProjectAnnotationConfigUnassignOutput,
  type OutputFormat,
} from "./formatAnnotationConfigs";
import type { CommonOptions, ConfirmationOptions } from "./options";

/**
 * Options for `px project annotation-config list|assign|unassign`. The project
 * and config are positional arguments.
 */
type ProjectAnnotationConfigOptions = CommonOptions<OutputFormat>;

/**
 * Options for `px project annotation-config set <project> [configs...]`.
 */
interface ProjectAnnotationConfigSetOptions
  extends CommonOptions<OutputFormat>, ConfirmationOptions {
  /**
   * `--none`: Clear every assignment. Required instead of config arguments so
   * an empty set is never sent by accident.
   *
   * @example true // px project annotation-config set my-project --none --yes
   */
  none?: boolean;
}

/**
 * Thrown by `set` when a config argument matches no annotation config by ID
 * or name, so the handler can report it without calling the server.
 */
class AnnotationConfigNotFoundError extends Error {
  constructor(identifier: string) {
    super(`Annotation config not found: ${identifier}`);
    this.name = "AnnotationConfigNotFoundError";
  }
}

/**
 * Resolve and validate the connection config shared by the handlers.
 */
function createProjectAnnotationConfigClient(
  options: CommonOptions<OutputFormat>
) {
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
 * Report a failed request and exit with the matching code. The server answers
 * 404 with a plain-text detail for an unknown project or annotation config,
 * 422 for an invalid config GlobalID in `set`, and 403 for viewers on the
 * write routes.
 */
async function exitOnProjectAnnotationConfigError({
  error,
  action,
  format,
}: {
  error: unknown;
  action: string;
  format?: OutputFormat;
}): Promise<never> {
  if (error instanceof AnnotationConfigNotFoundError) {
    writeStructuredError({
      format,
      message: error.message,
      code: "FAILURE",
      hint: "px annotation-config list",
    });
    return process.exit(ExitCode.FAILURE);
  }
  if (error instanceof HttpError) {
    const detail =
      (await error.response.text().catch(() => "")) || error.message;
    const message = `Error ${action}: ${detail}`;
    if (error.status === 401 || error.status === 403) {
      writeStructuredError({
        format,
        message,
        code: "AUTH_REQUIRED",
        hint: "px auth status",
      });
      return process.exit(ExitCode.AUTH_REQUIRED);
    }
    if (error.status === 400 || error.status === 422) {
      writeStructuredError({ format, message, code: "INVALID_ARGUMENT" });
      return process.exit(ExitCode.INVALID_ARGUMENT);
    }
    writeStructuredError({ format, message, code: "FAILURE" });
    return process.exit(ExitCode.FAILURE);
  }
  writeError({
    message: `Error ${action}: ${error instanceof Error ? error.message : String(error)}`,
  });
  return process.exit(getExitCodeForError(error));
}

/**
 * Handler for `project annotation-config list`
 */
async function projectAnnotationConfigListHandler(
  projectIdentifier: string,
  options: ProjectAnnotationConfigOptions
): Promise<void> {
  try {
    const client = createProjectAnnotationConfigClient(options);

    writeProgress({
      message: `Fetching annotation configs for project ${projectIdentifier}...`,
      noProgress: !options.progress,
    });

    // The project routes resolve a GlobalID or a name on the server, so the
    // identifier is passed through without a lookup.
    const configs = await listProjectAnnotationConfigs({
      client,
      project: projectIdentifier,
    });

    writeOutput({
      message: formatAnnotationConfigsOutput({
        configs,
        format: options.format,
      }),
    });
  } catch (error) {
    await exitOnProjectAnnotationConfigError({
      error,
      action: "listing project annotation configs",
      format: options.format,
    });
  }
}

/**
 * Handler for `project annotation-config assign`
 */
async function projectAnnotationConfigAssignHandler(
  projectIdentifier: string,
  configIdentifier: string,
  options: ProjectAnnotationConfigOptions
): Promise<void> {
  try {
    const client = createProjectAnnotationConfigClient(options);

    writeProgress({
      message: `Assigning annotation config ${configIdentifier} to project ${projectIdentifier}...`,
      noProgress: !options.progress,
    });

    const config = await assignProjectAnnotationConfig({
      client,
      project: projectIdentifier,
      config: configIdentifier,
    });

    writeOutput({
      message: formatAnnotationConfigOutput({
        config,
        format: options.format,
      }),
    });
  } catch (error) {
    await exitOnProjectAnnotationConfigError({
      error,
      action: "assigning project annotation config",
      format: options.format,
    });
  }
}

/**
 * Handler for `project annotation-config unassign`
 *
 * Does not confirm: it removes one assignment, deletes no data, and is undone
 * by `assign`.
 */
async function projectAnnotationConfigUnassignHandler(
  projectIdentifier: string,
  configIdentifier: string,
  options: ProjectAnnotationConfigOptions
): Promise<void> {
  try {
    const client = createProjectAnnotationConfigClient(options);

    writeProgress({
      message: `Unassigning annotation config ${configIdentifier} from project ${projectIdentifier}...`,
      noProgress: !options.progress,
    });

    await unassignProjectAnnotationConfig({
      client,
      project: projectIdentifier,
      config: configIdentifier,
    });

    writeOutput({
      message: formatProjectAnnotationConfigUnassignOutput({
        result: {
          unassigned: true,
          project: projectIdentifier,
          config: configIdentifier,
        },
        format: options.format,
      }),
    });
  } catch (error) {
    await exitOnProjectAnnotationConfigError({
      error,
      action: "unassigning project annotation config",
      format: options.format,
    });
  }
}

/**
 * Handler for `project annotation-config set`
 *
 * The replace route takes config GlobalIDs only, so names are resolved
 * against `GET /v1/annotation_configs` first: an ID match wins over a name
 * match, as on the server's single-config routes.
 */
async function projectAnnotationConfigSetHandler(
  projectIdentifier: string,
  configIdentifiers: string[],
  options: ProjectAnnotationConfigSetOptions
): Promise<void> {
  // Argument-shape validation runs before the try block so its `process.exit`
  // isn't caught and re-mapped by the catch-all error handler below.
  if (options.none && configIdentifiers.length > 0) {
    writeStructuredError({
      format: options.format,
      message: "Pass either config identifiers or --none, not both",
      code: "INVALID_ARGUMENT",
      hint: `px project annotation-config set ${projectIdentifier} --none`,
    });
    process.exit(ExitCode.INVALID_ARGUMENT);
  }
  if (!options.none && configIdentifiers.length === 0) {
    writeStructuredError({
      format: options.format,
      message:
        "Pass at least one config identifier, or --none to unassign every config",
      code: "INVALID_ARGUMENT",
      hint: `px project annotation-config set ${projectIdentifier} <config-identifier>...`,
    });
    process.exit(ExitCode.INVALID_ARGUMENT);
  }

  try {
    const client = createProjectAnnotationConfigClient(options);

    let configIds: string[] = [];
    let configNames: string[] = [];
    if (configIdentifiers.length > 0) {
      writeProgress({
        message: "Resolving annotation configs...",
        noProgress: !options.progress,
      });
      const allConfigs = await fetchAnnotationConfigs(client);
      const resolved = configIdentifiers.map((identifier) => {
        const match =
          allConfigs.find((config) => config.id === identifier) ??
          allConfigs.find((config) => config.name === identifier);
        if (!match) {
          throw new AnnotationConfigNotFoundError(identifier);
        }
        return match;
      });
      const unique = resolved.filter(
        (config, index) =>
          resolved.findIndex((other) => other.id === config.id) === index
      );
      configIds = unique.map((config) => config.id);
      configNames = unique.map((config) => config.name);
    }

    // Replacing can drop assignments that were not named on the command line,
    // so it confirms. No data is deleted, so there is no delete gate.
    await confirmOrExit({
      message:
        configIds.length === 0
          ? `Unassign every annotation config from project ${projectIdentifier}? The configs themselves are not deleted.`
          : `Replace the annotation configs assigned to project ${projectIdentifier} with ${configNames.join(", ")}? Assigned configs not listed are unassigned; no config is deleted.`,
      yes: options.yes,
    });

    writeProgress({
      message: `Setting annotation configs for project ${projectIdentifier}...`,
      noProgress: !options.progress,
    });

    const configs = await setProjectAnnotationConfigs({
      client,
      project: projectIdentifier,
      configIds,
    });

    writeOutput({
      message: formatAnnotationConfigsOutput({
        configs,
        format: options.format,
      }),
    });
  } catch (error) {
    await exitOnProjectAnnotationConfigError({
      error,
      action: "setting project annotation configs",
      format: options.format,
    });
  }
}

function addProjectAnnotationConfigCommonOptions(command: Command): Command {
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

export function createProjectAnnotationConfigListCommand(): Command {
  return addProjectAnnotationConfigCommonOptions(
    new Command("list")
      .description("List the annotation configs assigned to a project")
      .argument("<project-identifier>", "Project name or ID")
  )
    .addHelpText(
      "after",
      "\nExamples:\n" +
        "  px project annotation-config list my-project\n" +
        "  px project annotation-config list my-project --format raw --no-progress | jq -r '.[].name'\n"
    )
    .action(projectAnnotationConfigListHandler);
}

export function createProjectAnnotationConfigAssignCommand(): Command {
  return addProjectAnnotationConfigCommonOptions(
    new Command("assign")
      .description(
        "Assign an annotation config to a project (no-op if already assigned)"
      )
      .argument("<project-identifier>", "Project name or ID")
      .argument("<config-identifier>", "Annotation config name or ID")
  )
    .addHelpText(
      "after",
      "\nExamples:\n" +
        "  px project annotation-config assign my-project correctness\n" +
        "  px project annotation-config assign my-project <config-id> --format raw --no-progress\n"
    )
    .action(projectAnnotationConfigAssignHandler);
}

export function createProjectAnnotationConfigUnassignCommand(): Command {
  return addProjectAnnotationConfigCommonOptions(
    new Command("unassign")
      .description(
        "Unassign an annotation config from a project without deleting the config"
      )
      .argument("<project-identifier>", "Project name or ID")
      .argument("<config-identifier>", "Annotation config name or ID")
  )
    .addHelpText(
      "after",
      "\nExamples:\n" +
        "  px project annotation-config unassign my-project correctness\n" +
        "  px project annotation-config unassign my-project <config-id> --format raw --no-progress\n"
    )
    .action(projectAnnotationConfigUnassignHandler);
}

export function createProjectAnnotationConfigSetCommand(): Command {
  return addProjectAnnotationConfigCommonOptions(
    new Command("set")
      .description(
        "Replace the full set of annotation configs assigned to a project"
      )
      .argument("<project-identifier>", "Project name or ID")
      .argument(
        "[config-identifiers...]",
        "Annotation config names or IDs to assign; every other config is unassigned"
      )
      .option("--none", "Unassign every annotation config from the project")
      .option("-y, --yes", "Skip confirmation prompt")
  )
    .addHelpText(
      "after",
      "\nExamples:\n" +
        "  px project annotation-config set my-project correctness helpfulness\n" +
        "  px project annotation-config set my-project correctness --yes --format raw --no-progress\n" +
        "  px project annotation-config set my-project --none --yes\n"
    )
    .action(projectAnnotationConfigSetHandler);
}

/**
 * Create the `project annotation-config` command with `list`, `assign`,
 * `unassign`, and `set` subcommands.
 */
export function createProjectAnnotationConfigCommand(): Command {
  const command = new Command("annotation-config");
  command.description("List or change the annotation configs on a project");
  command.addCommand(createProjectAnnotationConfigListCommand());
  command.addCommand(createProjectAnnotationConfigAssignCommand());
  command.addCommand(createProjectAnnotationConfigUnassignCommand());
  command.addCommand(createProjectAnnotationConfigSetCommand());
  return command;
}
