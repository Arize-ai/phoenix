import * as fs from "fs";
import type { componentsV1, PhoenixClient } from "@arizeai/phoenix-client";
import { Command } from "commander";

import { createPhoenixClient } from "../client";
import { getConfigErrorMessage, resolveConfig } from "../config";
import { writeError, writeOutput, writeProgress } from "../io";
import { formatSessionOutput, type OutputFormat } from "./formatSessions";

type SessionData = componentsV1["schemas"]["SessionData"];
type SessionAnnotation = componentsV1["schemas"]["SessionAnnotation"];

interface SessionOptions {
  endpoint?: string;
  project?: string;
  apiKey?: string;
  format?: OutputFormat;
  progress?: boolean;
  file?: string;
  includeAnnotations?: boolean;
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
 * Session command handler
 */
async function sessionHandler(
  sessionId: string,
  options: SessionOptions
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
      process.exit(1);
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
    process.exit(1);
  }
}

/**
 * Create the session command
 */
export function createSessionCommand(): Command {
  const command = new Command("session");

  command
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
    .action(sessionHandler);

  return command;
}
