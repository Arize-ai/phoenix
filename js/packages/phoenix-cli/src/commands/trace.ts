import type { componentsV1, PhoenixClient } from "@arizeai/phoenix-client";

import { createPhoenixClient, resolveProjectId } from "../client";
import {
  getConfigErrorMessage,
  resolveConfig,
  validateConfig,
} from "../config";
import { writeError, writeOutput, writeProgress } from "../io";
import { buildTrace } from "../trace";

import { formatTraceOutput, type OutputFormat } from "./formatTraces";

import { Command } from "commander";
import * as fs from "fs";

type Span = componentsV1["schemas"]["Span"];

interface TraceOptions {
  endpoint?: string;
  project?: string;
  apiKey?: string;
  format?: OutputFormat;
  progress?: boolean;
  file?: string;
}

/**
 * Fetch spans for a specific trace
 */
async function fetchTraceSpans(
  client: PhoenixClient,
  projectIdentifier: string,
  traceId: string
): Promise<Span[]> {
  const allSpans: Span[] = [];
  let cursor: string | undefined;

  // Fetch all spans for the project and filter by trace ID
  // Note: This is a workaround since there's no direct trace-by-ID endpoint with spans
  do {
    const response = await client.GET(
      "/v1/projects/{project_identifier}/spans",
      {
        params: {
          path: {
            project_identifier: projectIdentifier,
          },
          query: {
            cursor,
            limit: 1000,
          },
        },
      }
    );

    if (response.error || !response.data) {
      throw new Error(`Failed to fetch spans: ${response.error}`);
    }

    // Filter spans for this trace
    const traceSpans = response.data.data.filter(
      (span) =>
        span.context.trace_id === traceId ||
        span.context.trace_id.startsWith(traceId)
    );

    allSpans.push(...traceSpans);

    // If we found spans for this trace, stop searching
    if (allSpans.length > 0) {
      break;
    }

    cursor = response.data.next_cursor || undefined;
  } while (cursor);

  return allSpans;
}

/**
 * Trace command handler
 */
async function traceHandler(
  traceId: string,
  options: TraceOptions
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

    // Fetch trace
    writeProgress({
      message: `Fetching trace ${traceId}...`,
      noProgress: !options.progress,
    });

    const spans = await fetchTraceSpans(client, projectId, traceId);

    if (spans.length === 0) {
      writeError({ message: `Trace not found: ${traceId}` });
      process.exit(1);
    }

    writeProgress({
      message: `Found ${spans.length} span(s)`,
      noProgress: !options.progress,
    });

    // Build trace
    const trace = buildTrace({ spans });

    // Output trace
    const outputFormat: OutputFormat = options.file
      ? "json"
      : options.format || "pretty";

    if (options.file && userSpecifiedFormat && options.format !== "json") {
      writeError({
        message: `Warning: --format is ignored when writing to a file; writing JSON to ${options.file}`,
      });
    }

    const output = formatTraceOutput({ trace, format: outputFormat });

    if (options.file) {
      fs.writeFileSync(options.file, output, "utf-8");
      writeProgress({
        message: `Wrote trace to ${options.file}`,
        noProgress: !options.progress,
      });
    } else {
      writeOutput({ message: output });
    }
  } catch (error) {
    writeError({
      message: `Error fetching trace: ${error instanceof Error ? error.message : String(error)}`,
    });
    process.exit(1);
  }
}

/**
 * Create the trace command
 */
export function createTraceCommand(): Command {
  const command = new Command("trace");

  command
    .description("Fetch a specific trace by ID")
    .argument("<trace-id>", "Trace identifier (OTEL trace ID or prefix)")
    .option("--endpoint <url>", "Phoenix API endpoint")
    .option("--project <name>", "Project name or UUID")
    .option("--api-key <key>", "Phoenix API key for authentication")
    .option(
      "--format <format>",
      "Output format: pretty, json, or raw",
      "pretty"
    )
    .option("--no-progress", "Disable progress indicators")
    .option("--file <path>", "Save trace to file instead of stdout")
    .action(traceHandler);

  return command;
}
