import type { PhoenixClient } from "@arizeai/phoenix-client";
import { Command } from "commander";

import { createPhoenixClient } from "../client";
import { getConfigErrorMessage, resolveConfig } from "../config";
import { ExitCode, getExitCodeForError } from "../exitCodes";
import { writeError, writeOutput } from "../io";
import { formatProjectsOutput, type OutputFormat } from "./formatProjects";

interface ProjectListOptions {
  endpoint?: string;
  project?: string;
  apiKey?: string;
  format?: OutputFormat;
  progress?: boolean;
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
        project: options.project,
        apiKey: options.apiKey,
      },
    });

    if (!config.endpoint) {
      const errors = [
        "Phoenix endpoint not configured. Set PHOENIX_HOST environment variable or use --endpoint flag.",
      ];
      writeError({ message: getConfigErrorMessage({ errors }) });
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
 * Create the `project` command with subcommands
 */
export function createProjectCommand(): Command {
  const command = new Command("project");
  command.description("Manage Phoenix projects");
  command.addCommand(configureProjectListCommand(new Command("list")));
  return command;
}
