import { HttpError, type PhoenixClient } from "@arizeai/phoenix-client";
import { setProjectRetentionPolicy } from "@arizeai/phoenix-client/projects";
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
  formatProjectRetentionOutput,
  formatProjectsOutput,
  type OutputFormat,
} from "./formatProjects";
import type {
  CommonOptions,
  ConfirmationOptions,
  DeleteOptions,
} from "./options";

/**
 * Options for `px project list`.
 */
interface ProjectListOptions extends CommonOptions<OutputFormat> {
  /**
   * `--limit <number>`: Maximum number of projects to fetch per page.
   * Defaults to 100.
   *
   * @example 50
   */
  limit?: number;
  /**
   * `--name-contains <filter>`: Return projects whose names contain this
   * substring. Matching is case-insensitive.
   *
   * @example production
   */
  nameContains?: string;
}

type ProjectSummary = {
  id: string;
  name: string;
  description?: string | null;
};

/**
 * Fetch all matching projects from Phoenix.
 *
 * @param params - Project query parameters.
 * @param params.client - Phoenix client used to fetch projects.
 * @param params.limit - Maximum number of projects to fetch per page.
 * @param params.nameContains - Optional case-insensitive project name filter.
 */
async function fetchProjects({
  client,
  limit: requestedLimit,
  nameContains,
}: {
  client: PhoenixClient;
  limit?: number;
  nameContains?: string;
}): Promise<ProjectSummary[]> {
  const allProjects: ProjectSummary[] = [];
  let cursor: string | undefined;
  const limit = requestedLimit || 100;

  do {
    const response = await client.GET("/v1/projects", {
      params: {
        query: {
          cursor,
          limit,
          include_experiment_projects: false,
          name_contains: nameContains,
        },
      },
    });

    if (response.error || !response.data) {
      throw new Error(`Failed to fetch projects: ${response.error}`);
    }

    allProjects.push(...response.data.data);
    cursor = response.data.next_cursor || undefined;
  } while (cursor);

  return allProjects;
}

/**
 * Handler for `project list`
 */
async function projectListHandler(options: ProjectListOptions): Promise<void> {
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
    const projects = await fetchProjects({
      client,
      limit: options.limit,
      nameContains: options.nameContains,
    });

    const output = formatProjectsOutput({
      projects,
      format: options.format,
    });
    writeOutput({ message: output });
  } catch (error) {
    writeError({
      message: `Error fetching projects: ${error instanceof Error ? error.message : String(error)}`,
    });
    process.exit(getExitCodeForError(error));
  }
}

export function configureProjectListCommand(command: Command): Command {
  return command
    .description("List all available Phoenix projects")
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
      "Maximum number of projects to fetch per page",
      parseInt
    )
    .option(
      "--name-contains <filter>",
      "Filter projects by name substring (case-insensitive)"
    )
    .action(projectListHandler);
}

/**
 * Handler for `project delete`
 */
async function projectDeleteHandler(
  projectIdentifier: string,
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
      message: `Delete project ${projectIdentifier}? This will also delete all traces, spans, sessions, and annotations. This cannot be undone.`,
      yes: options.yes,
    });

    writeProgress({
      message: `Deleting project ${projectIdentifier}...`,
      noProgress: !options.progress,
    });

    const response = await client.DELETE("/v1/projects/{project_identifier}", {
      params: {
        path: {
          project_identifier: projectIdentifier,
        },
      },
    });

    if (response.error) {
      throw new Error(`Failed to delete project: ${response.error}`);
    }

    writeProgress({
      message: `Project ${projectIdentifier} deleted successfully`,
      noProgress: !options.progress,
    });
  } catch (error) {
    writeError({
      message: `Error deleting project: ${error instanceof Error ? error.message : String(error)}`,
    });
    process.exit(getExitCodeForError(error));
  }
}

/**
 * Create the `project delete` command
 */
export function createProjectDeleteCommand(): Command {
  return new Command("delete")
    .description("Delete a Phoenix project")
    .argument("<project-identifier>", "Project name or ID")
    .option("--endpoint <url>", "Phoenix API endpoint")
    .option("--api-key <key>", "Phoenix API key for authentication")
    .option("-y, --yes", "Skip confirmation prompt")
    .option("--no-progress", "Disable progress indicators")
    .action(projectDeleteHandler);
}

/**
 * Options for `px project get <name>`.
 */
interface ProjectGetOptions extends CommonOptions<OutputFormat> {
  /**
   * `--limit <number>`: Maximum number of projects to fetch per page during
   * the lookup. Defaults to 100.
   *
   * @example 50
   */
  limit?: number;
}

function formatProjectGetOutput({
  project,
  format,
}: {
  project: ProjectSummary;
  format?: OutputFormat;
}): string {
  const selected = format || "pretty";
  if (selected === "raw") {
    return JSON.stringify(project);
  }
  if (selected === "json") {
    return JSON.stringify(project, null, 2);
  }
  // Pretty mode mirrors `formatProjectsOutput` table for one row.
  return formatProjectsOutput({ projects: [project], format: "pretty" });
}

/**
 * Handler for `project get <name>`.
 *
 * Reuses the paginated `fetchProjects` helper and filters by exact name
 * match. On miss, exit with `ExitCode.FAILURE` and emit a `StructuredError`
 * so agents can detect not-found without scraping prose.
 */
async function projectGetHandler(
  name: string,
  options: ProjectGetOptions
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
      message: `Looking up project '${name}'...`,
      noProgress: !options.progress,
    });

    const projects = await fetchProjects({
      client,
      limit: options.limit,
    });
    const match = projects.find((project) => project.name === name);

    if (!match) {
      writeStructuredError({
        format: options.format,
        message: `Project '${name}' not found`,
        code: "FAILURE",
        hint: "px project list --format raw",
      });
      process.exit(ExitCode.FAILURE);
    }

    writeOutput({
      message: formatProjectGetOutput({
        project: match,
        format: options.format,
      }),
    });
  } catch (error) {
    writeError({
      message: `Error fetching project: ${error instanceof Error ? error.message : String(error)}`,
    });
    process.exit(getExitCodeForError(error));
  }
}

export function createProjectGetCommand(): Command {
  return new Command("get")
    .description("Fetch a Phoenix project by exact name")
    .argument("<name>", "Project name (exact match)")
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
      "Maximum number of projects to fetch per page during the lookup",
      parseInt
    )
    .addHelpText(
      "after",
      "\nExamples:\n" +
        "  px project get my-project\n" +
        "  px project get my-project --format raw --no-progress | jq -r '.id'\n"
    )
    .action(projectGetHandler);
}

/**
 * Options for `px project retention set` and `px project retention reset`.
 */
interface ProjectRetentionOptions
  extends CommonOptions<OutputFormat>, ConfirmationOptions {}

const RETENTION_POLICY_LIST_HINT =
  "px api graphql '{ projectTraceRetentionPolicies { edges { node { id name } } } }'";

/**
 * Map a failed retention request to a `StructuredError` and exit code. The
 * server answers 403 for non-admins, 422 for a malformed policy GlobalID, and
 * 404 for an unknown project or policy, with the reason as a plain-text body.
 */
async function exitOnRetentionHttpError({
  error,
  action,
  format,
}: {
  error: HttpError;
  action: string;
  format?: OutputFormat;
}): Promise<never> {
  const detail = (await error.response.text().catch(() => "")) || error.message;
  const message = `Error ${action} project retention policy: ${detail}`;
  if (error.status === 401 || error.status === 403) {
    writeStructuredError({
      format,
      message,
      code: "AUTH_REQUIRED",
      hint: "px auth status",
    });
    process.exit(ExitCode.AUTH_REQUIRED);
  }
  if (error.status === 422) {
    writeStructuredError({
      format,
      message,
      code: "INVALID_ARGUMENT",
      hint: RETENTION_POLICY_LIST_HINT,
    });
    process.exit(ExitCode.INVALID_ARGUMENT);
  }
  writeStructuredError({ format, message, code: "FAILURE" });
  process.exit(ExitCode.FAILURE);
}

/**
 * Shared handler for `project retention set` and `project retention reset`.
 * A `null` policy ID resets the project to the default policy; the server
 * requires the field, so it is always sent explicitly.
 */
async function projectRetentionHandler({
  projectIdentifier,
  policyId,
  options,
}: {
  projectIdentifier: string;
  policyId: string | null;
  options: ProjectRetentionOptions;
}): Promise<void> {
  const action = policyId === null ? "resetting" : "setting";
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

    // Shortening retention lets the next sweep delete traces, so both verbs
    // confirm like the delete commands do.
    await confirmOrExit({
      message:
        policyId === null
          ? `Reset project ${projectIdentifier} to the default retention policy? Traces outside the default policy's retention window will be permanently deleted the next time it runs.`
          : `Assign retention policy ${policyId} to project ${projectIdentifier}? Traces outside the policy's retention window will be permanently deleted the next time it runs.`,
      yes: options.yes,
    });

    writeProgress({
      message:
        policyId === null
          ? `Resetting retention policy for project ${projectIdentifier}...`
          : `Assigning retention policy ${policyId} to project ${projectIdentifier}...`,
      noProgress: !options.progress,
    });

    const assignment = await setProjectRetentionPolicy({
      client,
      project: projectIdentifier,
      policyId,
    });

    writeOutput({
      message: formatProjectRetentionOutput({
        assignment,
        format: options.format,
      }),
    });
  } catch (error) {
    if (error instanceof HttpError) {
      await exitOnRetentionHttpError({ error, action, format: options.format });
    }
    writeError({
      message: `Error ${action} project retention policy: ${error instanceof Error ? error.message : String(error)}`,
    });
    process.exit(getExitCodeForError(error));
  }
}

function addRetentionOptions(command: Command): Command {
  return command
    .option("--endpoint <url>", "Phoenix API endpoint")
    .option("--api-key <key>", "Phoenix API key for authentication")
    .option(
      "--format <format>",
      "Output format: pretty, json, or raw",
      "pretty"
    )
    .option("-y, --yes", "Skip confirmation prompt")
    .option("--no-progress", "Disable progress indicators");
}

/**
 * Create the `project retention` command with `set` and `reset` subcommands.
 */
export function createProjectRetentionCommand(): Command {
  const command = new Command("retention");
  command.description(
    "Manage which trace retention policy a project uses (admin only)"
  );

  command.addCommand(
    addRetentionOptions(
      new Command("set")
        .description("Assign an existing trace retention policy to a project")
        .argument("<project-identifier>", "Project name or ID")
        .argument("<policy-id>", "Retention policy ID (GlobalID)")
    )
      .addHelpText(
        "after",
        "\nExamples:\n" +
          "  px project retention set my-project UHJvamVjdFRyYWNlUmV0ZW50aW9uUG9saWN5OjI=\n" +
          "  px project retention set my-project <policy-id> --yes --format raw\n"
      )
      .action(
        (
          projectIdentifier: string,
          policyId: string,
          options: ProjectRetentionOptions
        ) => projectRetentionHandler({ projectIdentifier, policyId, options })
      )
  );

  command.addCommand(
    addRetentionOptions(
      new Command("reset")
        .description("Reset a project to the default trace retention policy")
        .argument("<project-identifier>", "Project name or ID")
    )
      .addHelpText(
        "after",
        "\nExamples:\n" +
          "  px project retention reset my-project\n" +
          "  px project retention reset my-project --yes --format raw\n"
      )
      .action((projectIdentifier: string, options: ProjectRetentionOptions) =>
        projectRetentionHandler({ projectIdentifier, policyId: null, options })
      )
  );

  return command;
}

/**
 * Create the `project` command with subcommands
 */
export function createProjectCommand(): Command {
  const command = new Command("project");
  command.description("Manage Phoenix projects");
  command.addCommand(configureProjectListCommand(new Command("list")));
  command.addCommand(createProjectGetCommand());
  command.addCommand(createProjectDeleteCommand());
  command.addCommand(createProjectRetentionCommand());
  return command;
}
