import type { PhoenixClient } from "@arizeai/phoenix-client";

import { createPhoenixClient } from "../client";
import { getConfigErrorMessage, resolveConfig } from "../config";
import { writeError, writeOutput } from "../io";

import { formatProjectsOutput, type OutputFormat } from "./formatProjects";

import { Command } from "commander";

interface ProjectsOptions {
  endpoint?: string;
  project?: string;
  apiKey?: string;
  format?: OutputFormat;
  progress?: boolean;
  limit?: number;
}

/**
 * Fetch all projects from Phoenix
 */
async function fetchProjects(
  client: PhoenixClient,
  options: { limit?: number } = {}
): Promise<unknown[]> {
  const allProjects: unknown[] = [];
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
 * Projects command handler
 */
async function projectsHandler(options: ProjectsOptions): Promise<void> {
  try {
    // Resolve configuration
    const config = resolveConfig({
      cliOptions: {
        endpoint: options.endpoint,
        project: options.project,
        apiKey: options.apiKey,
      },
    });

    // Validate that we have endpoint (project not required for listing projects)
    if (!config.endpoint) {
      const errors = [
        "Phoenix endpoint not configured. Set PHOENIX_HOST environment variable or use --endpoint flag.",
      ];
      writeError({ message: getConfigErrorMessage({ errors }) });
      process.exit(1);
    }

    // Create client
    const client = createPhoenixClient({ config });

    // Fetch projects
    const projects = await fetchProjects(client, {
      limit: options.limit,
    });

    // Output projects
    const output = formatProjectsOutput({
      projects: projects as Array<{
        id: string;
        name: string;
        description?: string | null;
      }>,
      format: options.format,
    });
    writeOutput({ message: output });
  } catch (error) {
    writeError({
      message: `Error fetching projects: ${error instanceof Error ? error.message : String(error)}`,
    });
    process.exit(1);
  }
}

/**
 * Create the projects command
 */
export function createProjectsCommand(): Command {
  const command = new Command("projects");

  command
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
    .action(projectsHandler);

  return command;
}
