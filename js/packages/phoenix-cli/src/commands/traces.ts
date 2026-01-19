import type { componentsV1, PhoenixClient } from "@arizeai/phoenix-client";

import { createPhoenixClient, resolveProjectId } from "../client";
import {
  getConfigErrorMessage,
  resolveConfig,
  validateConfig,
} from "../config";
import { writeError, writeOutput, writeProgress } from "../io";
import { buildTrace, groupSpansByTrace, type Trace } from "../trace";

import { formatTracesOutput, type OutputFormat } from "./formatTraces";
import { fetchSpanAnnotations, type SpanAnnotation } from "./spanAnnotations";

import { Command } from "commander";
import * as fs from "fs";
import * as path from "path";

type Span = componentsV1["schemas"]["Span"];

interface TracesOptions {
  endpoint?: string;
  project?: string;
  apiKey?: string;
  format?: OutputFormat;
  progress?: boolean;
  limit?: number;
  lastNMinutes?: number;
  since?: string;
  maxConcurrent?: number;
  includeAnnotations?: boolean;
}

/**
 * Fetch spans for a project within a time range
 */
async function fetchSpans(
  client: PhoenixClient,
  projectIdentifier: string,
  options: {
    startTime?: string;
    endTime?: string;
    limit?: number;
  } = {}
): Promise<Span[]> {
  const allSpans: Span[] = [];
  let cursor: string | undefined;
  const pageLimit = 1000; // Max per page

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
            limit: pageLimit,
            start_time: options.startTime,
            end_time: options.endTime,
          },
        },
      }
    );

    if (response.error || !response.data) {
      throw new Error(`Failed to fetch spans: ${response.error}`);
    }

    allSpans.push(...response.data.data);
    cursor = response.data.next_cursor || undefined;

    // Stop if we have enough spans for the requested number of traces
    if (options.limit && allSpans.length >= options.limit * 10) {
      break;
    }
  } while (cursor);

  return allSpans;
}

/**
 * Get the last N traces
 */
async function getLastNTraces(
  client: PhoenixClient,
  projectIdentifier: string,
  limit: number,
  options: {
    lastNMinutes?: number;
    since?: string;
  } = {}
): Promise<Trace[]> {
  // Calculate time range
  let startTime: string | undefined;

  if (options.since) {
    startTime = options.since;
  } else if (options.lastNMinutes) {
    const now = new Date();
    const start = new Date(now.getTime() - options.lastNMinutes * 60 * 1000);
    startTime = start.toISOString();
  }

  // Fetch spans
  const spans = await fetchSpans(client, projectIdentifier, {
    startTime,
    limit,
  });

  // Group spans by trace
  const traceGroups = groupSpansByTrace({ spans });

  // Build trace objects
  const traces: Trace[] = [];
  for (const [traceId, traceSpans] of traceGroups.entries()) {
    try {
      const trace = buildTrace({ spans: traceSpans });
      traces.push(trace);
    } catch (error) {
      writeProgress({
        message: `Warning: Failed to build trace ${traceId}: ${error instanceof Error ? error.message : String(error)}`,
        noProgress: false,
      });
    }
  }

  // Sort by start time (newest first)
  traces.sort((a, b) => {
    if (!a.startTime || !b.startTime) return 0;
    return new Date(b.startTime).getTime() - new Date(a.startTime).getTime();
  });

  // Return last N traces
  return traces.slice(0, limit);
}

/**
 * Write traces to directory
 */
async function writeTracesToDirectory(
  traces: Trace[],
  directory: string,
  options: {
    noProgress?: boolean;
    maxConcurrent?: number;
  } = {}
): Promise<void> {
  // Create directory if it doesn't exist
  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory, { recursive: true });
  }

  const maxConcurrent = options.maxConcurrent || 10;
  const chunks: Trace[][] = [];

  // Split into chunks for concurrent processing
  for (let i = 0; i < traces.length; i += maxConcurrent) {
    chunks.push(traces.slice(i, i + maxConcurrent));
  }

  let completed = 0;

  for (const chunk of chunks) {
    await Promise.all(
      chunk.map(async (trace) => {
        try {
          // Write to file
          const filename = `${trace.traceId}.json`;
          const filepath = path.join(directory, filename);
          // Always write JSON when writing to files.
          const content = JSON.stringify(trace, null, 2);
          fs.writeFileSync(filepath, content, "utf-8");

          completed++;
          writeProgress({
            message: `[${completed}/${traces.length}] Wrote ${filename}`,
            noProgress: options.noProgress,
          });
        } catch (error) {
          writeProgress({
            message: `Warning: Failed to write trace ${trace.traceId}: ${error instanceof Error ? error.message : String(error)}`,
            noProgress: options.noProgress,
          });
        }
      })
    );
  }
}

/**
 * Traces command handler
 */
async function tracesHandler(
  directory: string | undefined,
  options: TracesOptions
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

    // Fetch traces
    const limit = options.limit || 10;

    writeProgress({
      message: `Fetching last ${limit} trace(s)...`,
      noProgress: !options.progress,
    });

    const traces = await getLastNTraces(client, projectId, limit, {
      lastNMinutes: options.lastNMinutes,
      since: options.since,
    });

    if (traces.length === 0) {
      writeProgress({
        message: "No traces found",
        noProgress: !options.progress,
      });
      return;
    }

    writeProgress({
      message: `Found ${traces.length} trace(s)`,
      noProgress: !options.progress,
    });

    if (options.includeAnnotations) {
      writeProgress({
        message: "Fetching span annotations...",
        noProgress: !options.progress,
      });

      const spanIds = traces
        .flatMap((trace) => trace.spans)
        .map((span) => span.context?.span_id)
        .filter((spanId): spanId is string => Boolean(spanId));

      const annotations = await fetchSpanAnnotations({
        client,
        projectIdentifier: projectId,
        spanIds,
        maxConcurrent: options.maxConcurrent,
      });

      const annotationsBySpanId = new Map<string, SpanAnnotation[]>();
      for (const annotation of annotations) {
        const spanId = annotation.span_id;
        if (!annotationsBySpanId.has(spanId)) {
          annotationsBySpanId.set(spanId, []);
        }
        annotationsBySpanId.get(spanId)!.push(annotation);
      }

      for (const trace of traces) {
        for (const span of trace.spans) {
          const spanId = span.context?.span_id;
          if (!spanId) continue;
          const spanAnnotations = annotationsBySpanId.get(spanId);
          if (spanAnnotations) {
            (
              span as typeof span & { annotations?: SpanAnnotation[] }
            ).annotations = spanAnnotations;
          }
        }
      }
    }

    // Output traces
    if (directory) {
      if (userSpecifiedFormat && options.format && options.format !== "json") {
        writeError({
          message: `Warning: --format is ignored when writing traces to a directory; writing JSON files to ${directory}`,
        });
      }

      // Write to directory
      writeProgress({
        message: `Writing traces to ${directory}...`,
        noProgress: !options.progress,
      });

      await writeTracesToDirectory(traces, directory, {
        noProgress: !options.progress,
        maxConcurrent: options.maxConcurrent,
      });

      writeProgress({
        message: `Done! Wrote ${traces.length} trace(s) to ${directory}`,
        noProgress: !options.progress,
      });
    } else {
      // Write to stdout
      const output = formatTracesOutput({ traces, format: options.format });
      writeOutput({ message: output });
    }
  } catch (error) {
    writeError({
      message: `Error fetching traces: ${error instanceof Error ? error.message : String(error)}`,
    });
    process.exit(1);
  }
}

/**
 * Create the traces command
 */
export function createTracesCommand(): Command {
  const command = new Command("traces");

  command
    .description("Fetch recent traces for the configured project")
    .argument("[directory]", "Directory to write trace files (optional)")
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
      "Fetch the last N traces (newest first)",
      parseInt,
      10
    )
    .option(
      "--last-n-minutes <number>",
      "Only fetch traces from the last N minutes",
      parseInt
    )
    .option("--since <timestamp>", "Fetch traces since this ISO timestamp")
    .option(
      "--max-concurrent <number>",
      "Maximum concurrent fetches for bulk operations",
      parseInt,
      10
    )
    .option(
      "--include-annotations",
      "Include span annotations in the trace export"
    )
    .action(tracesHandler);

  return command;
}
