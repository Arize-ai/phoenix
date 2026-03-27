import * as fs from "fs";
import type { componentsV1, PhoenixClient } from "@arizeai/phoenix-client";
import { Command } from "commander";

import { createPhoenixClient, resolveProjectId } from "../client";
import {
  getConfigErrorMessage,
  resolveConfig,
  validateConfig,
} from "../config";
import { ExitCode, getExitCodeForError } from "../exitCodes";
import { writeError, writeOutput, writeProgress } from "../io";
import {
  formatSessionOutput,
  formatSessionsOutput,
  type OutputFormat,
} from "./formatSessions";

type SessionData = componentsV1["schemas"]["SessionData"];
type SessionAnnotation = componentsV1["schemas"]["SessionAnnotation"];

interface SessionGetOptions {
  endpoint?: string;
  project?: string;
  apiKey?: string;
  format?: OutputFormat;
  progress?: boolean;
  file?: string;
  includeAnnotations?: boolean;
}

interface SessionListOptions {
  endpoint?: string;
  project?: string;
  apiKey?: string;
  format?: OutputFormat;
  progress?: boolean;
  limit?: number;
  order?: "asc" | "desc";
}

/**
 * Fetch a single session by identifier
 */
async function fetchSession(
  client: PhoenixClient,
  sessionIdentifier: string
): Promise<SessionData> {
  const response = await client.GET("/v1/sessions/{session_identifier}", {
    params: {
      path: {
        session_identifier: sessionIdentifier,
      },
    },
  });

  if (response.error || !response.data) {
    throw new Error(`Failed to fetch session: ${response.error}`);
  }

  return response.data.data;
}

/**
 * Fetch annotations for a session
 */
async function fetchSessionAnnotations(
  client: PhoenixClient,
  projectIdentifier: string,
  sessionId: string
): Promise<SessionAnnotation[]> {
  const allAnnotations: SessionAnnotation[] = [];
  let cursor: string | undefined;

  do {
    const response = await client.GET(
      "/v1/projects/{project_identifier}/session_annotations",
      {
        params: {
          path: {
            project_identifier: projectIdentifier,
          },
          query: {
            session_ids: [sessionId],
            cursor,
            limit: 100,
          },
        },
      }
    );

    if (response.error || !response.data) {
      throw new Error(`Failed to fetch session annotations: ${response.error}`);
    }

    allAnnotations.push(...response.data.data);
    cursor = response.data.next_cursor || undefined;
  } while (cursor);

  return allAnnotations;
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
 * Handler for `session get`
 */
async function sessionGetHandler(
  sessionId: string,
  options: SessionGetOptions
): Promise<void> {
  try {
    const userSpecifiedFormat =
      process.argv.includes("--format") ||
      process.argv.some((arg) => arg.startsWith("--format="));

    // Resolve configuration
    const config = resolveConfig({
      cliOptions: {
        endpoint: options.endpoint,
        project: options.project,
        apiKey: options.apiKey,
      },
    });

    // Validate that we have endpoint
    if (!config.endpoint) {
      const errors = [
        "Phoenix endpoint not configured. Set PHOENIX_HOST environment variable or use --endpoint flag.",
      ];
      writeError({ message: getConfigErrorMessage({ errors }) });
      process.exit(ExitCode.INVALID_ARGUMENT);
    }

    // Create client
    const client = createPhoenixClient({ config });

    writeProgress({
      message: `Fetching session ${sessionId}...`,
      noProgress: !options.progress,
    });

    // Fetch session
    const session = await fetchSession(client, sessionId);

    writeProgress({
      message: `Fetched session with ${session.traces.length} trace(s)`,
      noProgress: !options.progress,
    });

    // Optionally fetch annotations
    let annotations: SessionAnnotation[] | undefined;
    if (options.includeAnnotations) {
      writeProgress({
        message: "Fetching session annotations...",
        noProgress: !options.progress,
      });

      annotations = await fetchSessionAnnotations(
        client,
        session.project_id,
        session.session_id
      );

      writeProgress({
        message: `Found ${annotations.length} annotation(s)`,
        noProgress: !options.progress,
      });
    }

    // Determine output format
    const outputFormat: OutputFormat = options.file
      ? "json"
      : options.format || "pretty";

    if (options.file && userSpecifiedFormat && options.format !== "json") {
      writeError({
        message: `Warning: --format is ignored when writing to a file; writing JSON to ${options.file}`,
      });
    }

    // Format output
    const output = formatSessionOutput({
      session,
      annotations,
      format: outputFormat,
    });

    if (options.file) {
      fs.writeFileSync(options.file, output, "utf-8");
      writeProgress({
        message: `Wrote session to ${options.file}`,
        noProgress: !options.progress,
      });
    } else {
      writeOutput({ message: output });
    }
  } catch (error) {
    writeError({
      message: `Error fetching session: ${error instanceof Error ? error.message : String(error)}`,
    });
    process.exit(getExitCodeForError(error));
  }
}

/**
 * Handler for `session list`
 */
async function sessionListHandler(options: SessionListOptions): Promise<void> {
  try {
    const config = resolveConfig({
      cliOptions: {
        endpoint: options.endpoint,
        project: options.project,
        apiKey: options.apiKey,
      },
    });

    const validation = validateConfig({ config });
    if (!validation.valid) {
      writeError({
        message: getConfigErrorMessage({ errors: validation.errors }),
      });
      process.exit(ExitCode.INVALID_ARGUMENT);
    }

    const client = createPhoenixClient({ config });

    const projectIdentifier = config.project;
    if (!projectIdentifier) {
      writeError({ message: "Project not configured" });
      process.exit(ExitCode.INVALID_ARGUMENT);
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

    const output = formatSessionsOutput({
      sessions,
      format: options.format,
    });
    writeOutput({ message: output });
  } catch (error) {
    writeError({
      message: `Error fetching sessions: ${error instanceof Error ? error.message : String(error)}`,
    });
    process.exit(getExitCodeForError(error));
  }
}

export function createSessionGetCommand(): Command {
  return new Command("get")
    .description("View a session's conversation flow")
    .argument(
      "<session-id>",
      "Session identifier (GlobalID or user-provided session_id)"
    )
    .option("--endpoint <url>", "Phoenix API endpoint")
    .option("--project <name>", "Project name or ID")
    .option("--api-key <key>", "Phoenix API key for authentication")
    .option(
      "--format <format>",
      "Output format: pretty, json, or raw",
      "pretty"
    )
    .option("--no-progress", "Disable progress indicators")
    .option("--file <path>", "Save session to file instead of stdout")
    .option("--include-annotations", "Include session annotations")
    .action(sessionGetHandler);
}

export function createSessionListCommand(): Command {
  return new Command("list")
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
      (v: string) => parseInt(v, 10),
      10
    )
    .option("--order <order>", "Sort order: asc or desc", "desc")
    .action(sessionListHandler);
}

/**
 * Create the `session` command with subcommands
 */
export function createSessionCommand(): Command {
  const command = new Command("session");
  command.description("Manage Phoenix sessions");
  command.addCommand(createSessionListCommand());
  command.addCommand(createSessionGetCommand());
  return command;
}
