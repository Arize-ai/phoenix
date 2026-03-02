import type { componentsV1, PhoenixClient } from "@arizeai/phoenix-client";
import { Command } from "commander";

import { createPhoenixClient, resolveProjectId } from "../client";
import {
  getConfigErrorMessage,
  resolveConfig,
  validateConfig,
} from "../config";
import { writeError, writeOutput, writeProgress } from "../io";
import { formatSessionsOutput, type OutputFormat } from "./formatSessions";

type SessionData = componentsV1["schemas"]["SessionData"];

interface SessionsOptions {
  endpoint?: string;
  project?: string;
  apiKey?: string;
  format?: OutputFormat;
  progress?: boolean;
  limit?: number;
  order?: "asc" | "desc";
}

/**
 * Fetch sessions for a project from Phoenix
 */
async function fetchSessions(
  client: PhoenixClient,
  projectIdentifier: string,
  options: { limit?: number; order?: "asc" | "desc" } = {}
): Promise<SessionData[]> {
  const allSessions: SessionData[] = [];
  let cursor: string | undefined;
  const targetLimit = options.limit || 10;

  do {
    const response = await client.GET(
      "/v1/projects/{project_identifier}/sessions",
      {
        params: {
          path: {
            project_identifier: projectIdentifier,
          },
          query: {
            cursor,
            limit: Math.min(targetLimit - allSessions.length, 100),
            order: options.order,
          },
        },
      }
    );

    if (response.error || !response.data) {
      throw new Error(`Failed to fetch sessions: ${response.error}`);
    }

    allSessions.push(...response.data.data);
    cursor = response.data.next_cursor || undefined;

    if (allSessions.length >= targetLimit) {
      break;
    }
  } while (cursor);

  return allSessions.slice(0, targetLimit);
}

/**
 * Sessions command handler
 */
async function sessionsHandler(options: SessionsOptions): Promise<void> {
  try {
    // Resolve configuration
    const config = resolveConfig({
      cliOptions: {
        endpoint: options.endpoint,
        project: options.project,
        apiKey: options.apiKey,
      },
    });

    // Validate configuration
    const validation = validateConfig({ config });
    if (!validation.valid) {
      writeError({
        message: getConfigErrorMessage({ errors: validation.errors }),
      });
      process.exit(1);
    }

    // Create client
    const client = createPhoenixClient({ config });

    // Resolve project ID
    const projectIdentifier = config.project;
    if (!projectIdentifier) {
      writeError({ message: "Project not configured" });
      process.exit(1);
    }

    writeProgress({
      message: `Resolving project: ${projectIdentifier}`,
      noProgress: !options.progress,
    });

    const projectId = await resolveProjectId({
      client,
      projectIdentifier,
    });

    const limit = options.limit || 10;

    writeProgress({
      message: `Fetching sessions for project ${projectId}...`,
      noProgress: !options.progress,
    });

    // Fetch sessions
    const sessions = await fetchSessions(client, projectId, {
      limit,
      order: options.order,
    });

    if (sessions.length === 0) {
      writeProgress({
        message: "No sessions found",
        noProgress: !options.progress,
      });
      return;
    }

    writeProgress({
      message: `Found ${sessions.length} session(s)`,
      noProgress: !options.progress,
    });

    // Output sessions
    const output = formatSessionsOutput({
      sessions,
      format: options.format,
    });
    writeOutput({ message: output });
  } catch (error) {
    writeError({
      message: `Error fetching sessions: ${error instanceof Error ? error.message : String(error)}`,
    });
    process.exit(1);
  }
}

/**
 * Create the sessions command
 */
export function createSessionsCommand(): Command {
  const command = new Command("sessions");

  command
    .description("List sessions for a project")
    .option("--endpoint <url>", "Phoenix API endpoint")
    .option("--project <name>", "Project name or ID")
    .option("--api-key <key>", "Phoenix API key for authentication")
    .option(
      "--format <format>",
      "Output format: pretty, json, or raw",
      "pretty"
    )
    .option("--no-progress", "Disable progress indicators")
    .option(
      "-n, --limit <number>",
      "Maximum number of sessions to return",
      parseInt,
      10
    )
    .option("--order <order>", "Sort order: asc or desc", "desc")
    .action(sessionsHandler);

  return command;
}
