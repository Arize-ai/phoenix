import type { PhoenixClient } from "@arizeai/phoenix-client";
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
import { formatProjectsOutput, type OutputFormat } from "./formatProjects";
import type { CommonOptions, DeleteOptions } from "./options";

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
}

type ProjectSummary = {
  id: string;
  name: string;
  description?: string | null;
};

/**
 * Fetch all projects from Phoenix
 */
async function fetchProjects(
  client: PhoenixClient,
  options: { limit?: number } = {}
): Promise<ProjectSummary[]> {
  const allProjects: ProjectSummary[] = [];
  let cursor: string | undefined;
  const limit = options.limit || 100;

  do {
    const response = await client.GET("/v1/projects", {
      params: {
        query: {
          cursor,
          limit,
          include_experiment_projects: false,
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
    const projects = await fetchProjects(client, {
      limit: options.limit,
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

    const projects = await fetchProjects(client, { limit: options.limit });
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
 * Create the `project` command with subcommands
 */
export function createProjectCommand(): Command {
  const command = new Command("project");
  command.description("Manage Phoenix projects");
  command.addCommand(configureProjectListCommand(new Command("list")));
  command.addCommand(createProjectGetCommand());
  command.addCommand(createProjectDeleteCommand());
  return command;
}
