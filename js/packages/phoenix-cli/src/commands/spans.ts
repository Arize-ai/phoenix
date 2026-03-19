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
import type { SpanWithAnnotations } from "../trace";
import { formatSpansOutput, type OutputFormat } from "./formatSpans";
import { fetchSpanAnnotations, type SpanAnnotation } from "./spanAnnotations";

type Span = componentsV1["schemas"]["Span"];

interface SpansOptions {
  endpoint?: string;
  project?: string;
  apiKey?: string;
  format?: OutputFormat;
  progress?: boolean;
  limit?: number;
  lastNMinutes?: number;
  since?: string;
  spanKind?: string[];
  statusCode?: string[];
  name?: string[];
  traceId?: string[];
  parentId?: string;
  includeAnnotations?: boolean;
}

/**
 * Fetch spans for a project with optional filters
 */
async function fetchSpansForProject(
  client: PhoenixClient,
  projectIdentifier: string,
  options: {
    startTime?: string;
    endTime?: string;
    traceIds?: string[];
    parentId?: string;
    names?: string[];
    spanKinds?: string[];
    statusCodes?: string[];
    limit: number;
  }
): Promise<Span[]> {
  const allSpans: Span[] = [];
  let cursor: string | undefined;
  const pageLimit = Math.min(options.limit, 1000);

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
            trace_id: options.traceIds,
            parent_id: options.parentId,
            name: options.names,
            span_kind: options.spanKinds,
            status_code: options.statusCodes,
          },
        },
      }
    );

    if (response.error || !response.data) {
      throw new Error(`Failed to fetch spans: ${response.error}`);
    }

    allSpans.push(...response.data.data);
    cursor = response.data.next_cursor || undefined;

    if (allSpans.length >= options.limit) {
      break;
    }
  } while (cursor);

  return allSpans.slice(0, options.limit);
}

/**
 * Spans command handler
 */
async function spansHandler(
  file: string | undefined,
  options: SpansOptions
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
      process.exit(ExitCode.INVALID_ARGUMENT);
    }

    // Create client
    const client = createPhoenixClient({ config });

    // Resolve project ID
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

    // Calculate time range
    let startTime: string | undefined;

    if (options.since) {
      startTime = options.since;
    } else if (options.lastNMinutes) {
      const now = new Date();
      const start = new Date(now.getTime() - options.lastNMinutes * 60 * 1000);
      startTime = start.toISOString();
    }

    const limit = options.limit || 100;

    writeProgress({
      message: `Fetching up to ${limit} span(s)...`,
      noProgress: !options.progress,
    });

    const spans: SpanWithAnnotations[] = await fetchSpansForProject(
      client,
      projectId,
      {
        startTime,
        limit,
        traceIds: options.traceId,
        parentId: options.parentId,
        names: options.name,
        spanKinds: options.spanKind,
        statusCodes: options.statusCode,
      }
    );

    if (spans.length === 0) {
      writeProgress({
        message: "No spans found",
        noProgress: !options.progress,
      });
      return;
    }

    writeProgress({
      message: `Found ${spans.length} span(s)`,
      noProgress: !options.progress,
    });

    // Fetch annotations if requested
    if (options.includeAnnotations) {
      writeProgress({
        message: "Fetching span annotations...",
        noProgress: !options.progress,
      });

      const spanIds = spans
        .map((span) => span.context?.span_id)
        .filter((spanId): spanId is string => Boolean(spanId));

      const annotations = await fetchSpanAnnotations({
        client,
        projectIdentifier: projectId,
        spanIds,
      });

      const annotationsBySpanId = new Map<string, SpanAnnotation[]>();
      for (const annotation of annotations) {
        const spanId = annotation.span_id;
        if (!annotationsBySpanId.has(spanId)) {
          annotationsBySpanId.set(spanId, []);
        }
        annotationsBySpanId.get(spanId)!.push(annotation);
      }

      for (const span of spans) {
        const spanId = span.context?.span_id;
        if (!spanId) continue;
        const spanAnnotations = annotationsBySpanId.get(spanId);
        if (spanAnnotations) {
          span.annotations = spanAnnotations;
        }
      }
    }

    // Output spans
    if (file) {
      if (userSpecifiedFormat && options.format && options.format !== "json") {
        writeError({
          message: `Warning: --format is ignored when writing to a file; writing JSON to ${file}`,
        });
      }

      const content = JSON.stringify(spans, null, 2);
      fs.writeFileSync(file, content, "utf-8");

      writeProgress({
        message: `Done! Wrote ${spans.length} span(s) to ${file}`,
        noProgress: !options.progress,
      });
    } else {
      const output = formatSpansOutput({ spans, format: options.format });
      writeOutput({ message: output });
    }
  } catch (error) {
    writeError({
      message: `Error fetching spans: ${error instanceof Error ? error.message : String(error)}`,
    });
    process.exit(getExitCodeForError(error));
  }
}

/**
 * Create the spans command
 */
export function createSpansCommand(): Command {
  const command = new Command("spans");

  command
    .description("Fetch spans for the configured project with filtering")
    .argument("[file]", "File path to write span data as JSON (optional)")
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
      "Maximum number of spans to fetch (newest first)",
      parseInt,
      100
    )
    .option(
      "--last-n-minutes <number>",
      "Only fetch spans from the last N minutes",
      parseInt
    )
    .option("--since <timestamp>", "Fetch spans since this ISO timestamp")
    .option(
      "--span-kind <kinds...>",
      "Filter by span kind (LLM, CHAIN, TOOL, RETRIEVER, EMBEDDING, AGENT, RERANKER, GUARDRAIL, EVALUATOR, UNKNOWN)"
    )
    .option(
      "--status-code <codes...>",
      "Filter by status code (OK, ERROR, UNSET)"
    )
    .option("--name <names...>", "Filter by span name(s)")
    .option("--trace-id <ids...>", "Filter by trace ID(s)")
    .option(
      "--parent-id <id>",
      'Filter by parent span ID (use "null" for root spans only)'
    )
    .option("--include-annotations", "Include span annotations in the output")
    .action(spansHandler);

  return command;
}
