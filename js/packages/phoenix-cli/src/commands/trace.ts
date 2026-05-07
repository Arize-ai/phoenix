import * as fs from "fs";
import * as path from "path";
import type { componentsV1, PhoenixClient } from "@arizeai/phoenix-client";
import { addTraceNote } from "@arizeai/phoenix-client/traces";
import { Command } from "commander";

import { createPhoenixClient, resolveProjectId } from "../client";
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
  buildSpanNote,
  buildTrace,
  buildTraceNote,
  groupSpansByTrace,
  type SpanNote,
  type SpanWithAnnotations,
  type Trace,
  type TraceNote,
} from "../trace";
import {
  buildAnnotationMutationResult,
  getAnnotationMutationHelpText,
  getResponseErrorMessage,
  normalizeAnnotationInput,
} from "./annotationMutationUtils";
import {
  formatAnnotationDeleteOutput,
  type AnnotationDeleteFilter,
  type OutputFormat as AnnotationDeleteOutputFormat,
} from "./formatAnnotationDelete";
import {
  formatAnnotationListOutput,
  type OutputFormat as AnnotationListOutputFormat,
} from "./formatAnnotationList";
import {
  formatAnnotationMutationOutput,
  type OutputFormat as AnnotationMutationOutputFormat,
} from "./formatAnnotationMutation";
import {
  formatNoteMutationOutput,
  type OutputFormat as NoteMutationOutputFormat,
} from "./formatNoteMutation";
import {
  formatTraceOutput,
  formatTracesOutput,
  type OutputFormat as TraceOutputFormat,
} from "./formatTraces";
import {
  buildNoteMutationResult,
  NOTE_ANNOTATION_NAME,
  normalizeNoteText,
} from "./noteMutationUtils";
import { fetchSpanAnnotations, type SpanAnnotation } from "./spanAnnotations";
import {
  fetchTraceAnnotations,
  type TraceAnnotation,
} from "./traceAnnotations";

type Span = componentsV1["schemas"]["Span"];

function attachSpanAnnotationsToSpans(
  spans: SpanWithAnnotations[],
  annotations: SpanAnnotation[]
): void {
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

function attachTraceAnnotationsToTraces(
  traces: Trace[],
  annotations: TraceAnnotation[]
): void {
  const annotationsByTraceId = new Map<string, TraceAnnotation[]>();
  for (const annotation of annotations) {
    const traceId = annotation.trace_id;
    if (!annotationsByTraceId.has(traceId)) {
      annotationsByTraceId.set(traceId, []);
    }
    annotationsByTraceId.get(traceId)!.push(annotation);
  }

  for (const trace of traces) {
    const traceAnnotations = annotationsByTraceId.get(trace.traceId);
    if (traceAnnotations) {
      trace.annotations = traceAnnotations;
    }
  }
}

function attachSpanNotesToSpans(
  spans: SpanWithAnnotations[],
  notes: SpanAnnotation[]
): void {
  const notesBySpanId = new Map<string, SpanNote[]>();
  for (const note of notes) {
    const spanId = note.span_id;
    if (!notesBySpanId.has(spanId)) {
      notesBySpanId.set(spanId, []);
    }
    notesBySpanId.get(spanId)!.push(buildSpanNote(note));
  }

  for (const span of spans) {
    const spanId = span.context?.span_id;
    if (!spanId) continue;
    const spanNotes = notesBySpanId.get(spanId);
    if (spanNotes) {
      span.notes = spanNotes;
    }
  }
}

function attachTraceNotesToTraces(
  traces: Trace[],
  notes: TraceAnnotation[]
): void {
  const notesByTraceId = new Map<string, TraceNote[]>();
  for (const note of notes) {
    const traceId = note.trace_id;
    if (!notesByTraceId.has(traceId)) {
      notesByTraceId.set(traceId, []);
    }
    notesByTraceId.get(traceId)!.push(buildTraceNote(note));
  }

  for (const trace of traces) {
    const traceNotes = notesByTraceId.get(trace.traceId);
    if (traceNotes) {
      trace.notes = traceNotes;
    }
  }
}

function getResolvedTraceId(spans: Span[]): string | undefined {
  return spans[0]?.context?.trace_id;
}

interface TraceGetOptions {
  endpoint?: string;
  project?: string;
  apiKey?: string;
  format?: TraceOutputFormat;
  progress?: boolean;
  file?: string;
  includeAnnotations?: boolean;
  includeNotes?: boolean;
}

interface TraceListOptions {
  endpoint?: string;
  project?: string;
  apiKey?: string;
  format?: TraceOutputFormat;
  progress?: boolean;
  limit?: number;
  lastNMinutes?: number;
  since?: string;
  maxConcurrent?: number;
  includeAnnotations?: boolean;
  includeNotes?: boolean;
}

interface TraceAnnotateOptions {
  endpoint?: string;
  apiKey?: string;
  format?: AnnotationMutationOutputFormat;
  progress?: boolean;
  name?: string;
  label?: string;
  score?: string;
  explanation?: string;
  annotatorKind?: string;
  identifier?: string;
}

interface TraceAddNoteOptions {
  endpoint?: string;
  apiKey?: string;
  format?: NoteMutationOutputFormat;
  progress?: boolean;
  text?: string;
  identifier?: string;
}

/**
 * Fetch spans for a project within a time range
 */
async function fetchProjectSpans(
  client: PhoenixClient,
  projectIdentifier: string,
  options: {
    startTime?: string;
    endTime?: string;
    traceIds?: string[];
    limit?: number;
  } = {}
): Promise<Span[]> {
  const allSpans: Span[] = [];
  let cursor: string | undefined;
  const pageLimit = 1000;

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
          },
        },
      }
    );

    if (response.error || !response.data) {
      throw new Error(`Failed to fetch spans: ${response.error}`);
    }

    allSpans.push(...response.data.data);
    cursor = response.data.next_cursor || undefined;

    if (options.limit && allSpans.length >= options.limit * 10) {
      break;
    }
  } while (cursor);

  return allSpans;
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
  let startTime: string | undefined;

  if (options.since) {
    startTime = options.since;
  } else if (options.lastNMinutes) {
    const now = new Date();
    const start = new Date(now.getTime() - options.lastNMinutes * 60 * 1000);
    startTime = start.toISOString();
  }

  const spans = await fetchProjectSpans(client, projectIdentifier, {
    startTime,
    limit,
  });

  const traceGroups = groupSpansByTrace({ spans });

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

  traces.sort((firstTrace, secondTrace) => {
    if (!firstTrace.startTime || !secondTrace.startTime) return 0;
    return (
      new Date(secondTrace.startTime).getTime() -
      new Date(firstTrace.startTime).getTime()
    );
  });

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
  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory, { recursive: true });
  }

  const maxConcurrent = options.maxConcurrent || 10;
  const traceChunks: Trace[][] = [];

  for (let index = 0; index < traces.length; index += maxConcurrent) {
    traceChunks.push(traces.slice(index, index + maxConcurrent));
  }

  let completed = 0;

  for (const traceChunk of traceChunks) {
    await Promise.all(
      traceChunk.map(async (trace) => {
        try {
          const filename = `${trace.traceId}.json`;
          const filepath = path.join(directory, filename);
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
 * Handler for `trace get`
 */
async function traceGetHandler(
  traceId: string,
  options: TraceGetOptions
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

    // Fetch trace
    writeProgress({
      message: `Fetching trace ${traceId}...`,
      noProgress: !options.progress,
    });

    const spans = await fetchTraceSpans(client, projectId, traceId);

    if (spans.length === 0) {
      writeError({ message: `Trace not found: ${traceId}` });
      process.exit(ExitCode.FAILURE);
    }

    writeProgress({
      message: `Found ${spans.length} span(s)`,
      noProgress: !options.progress,
    });

    const traceSpans: SpanWithAnnotations[] = spans;
    const resolvedTraceId = getResolvedTraceId(spans);
    let traceAnnotations: TraceAnnotation[] | undefined;
    let traceNotes: TraceAnnotation[] | undefined;
    if (options.includeAnnotations) {
      writeProgress({
        message: "Fetching trace and span annotations...",
        noProgress: !options.progress,
      });

      traceAnnotations = await fetchTraceAnnotations({
        client,
        projectIdentifier: projectId,
        traceIds: resolvedTraceId ? [resolvedTraceId] : [traceId],
        excludeAnnotationNames: [NOTE_ANNOTATION_NAME],
      });

      const spanIds = traceSpans
        .map((span) => span.context?.span_id)
        .filter((spanId): spanId is string => Boolean(spanId));
      const spanAnnotations = await fetchSpanAnnotations({
        client,
        projectIdentifier: projectId,
        spanIds,
        excludeAnnotationNames: [NOTE_ANNOTATION_NAME],
      });
      attachSpanAnnotationsToSpans(traceSpans, spanAnnotations);
    }
    if (options.includeNotes) {
      writeProgress({
        message: "Fetching trace and span notes...",
        noProgress: !options.progress,
      });

      traceNotes = await fetchTraceAnnotations({
        client,
        projectIdentifier: projectId,
        traceIds: resolvedTraceId ? [resolvedTraceId] : [traceId],
        includeAnnotationNames: [NOTE_ANNOTATION_NAME],
      });

      const spanIds = traceSpans
        .map((span) => span.context?.span_id)
        .filter((spanId): spanId is string => Boolean(spanId));
      const spanNotes = await fetchSpanAnnotations({
        client,
        projectIdentifier: projectId,
        spanIds,
        includeAnnotationNames: [NOTE_ANNOTATION_NAME],
      });
      attachSpanNotesToSpans(traceSpans, spanNotes);
    }

    // Build trace
    const trace = buildTrace({ spans: traceSpans });
    if (traceAnnotations?.length) {
      trace.annotations = traceAnnotations;
    }
    if (traceNotes?.length) {
      trace.notes = traceNotes.map(buildTraceNote);
    }

    // Output trace
    const outputFormat: TraceOutputFormat = options.file
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
    process.exit(getExitCodeForError(error));
  }
}

/**
 * Handler for `trace list`
 */
async function traceListHandler(
  directory: string | undefined,
  options: TraceListOptions
): Promise<void> {
  try {
    const userSpecifiedFormat =
      process.argv.includes("--format") ||
      process.argv.some((arg) => arg.startsWith("--format="));

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
        message: "Fetching trace and span annotations...",
        noProgress: !options.progress,
      });

      const traceAnnotations = await fetchTraceAnnotations({
        client,
        projectIdentifier: projectId,
        traceIds: traces.map((trace) => trace.traceId),
        excludeAnnotationNames: [NOTE_ANNOTATION_NAME],
        maxConcurrent: options.maxConcurrent,
      });
      attachTraceAnnotationsToTraces(traces, traceAnnotations);

      const spanIds = traces
        .flatMap((trace) => trace.spans)
        .map((span) => span.context?.span_id)
        .filter((spanId): spanId is string => Boolean(spanId));

      const spanAnnotations = await fetchSpanAnnotations({
        client,
        projectIdentifier: projectId,
        spanIds,
        excludeAnnotationNames: [NOTE_ANNOTATION_NAME],
        maxConcurrent: options.maxConcurrent,
      });
      for (const trace of traces) {
        attachSpanAnnotationsToSpans(trace.spans, spanAnnotations);
      }
    }
    if (options.includeNotes) {
      writeProgress({
        message: "Fetching trace and span notes...",
        noProgress: !options.progress,
      });

      const traceNotes = await fetchTraceAnnotations({
        client,
        projectIdentifier: projectId,
        traceIds: traces.map((trace) => trace.traceId),
        includeAnnotationNames: [NOTE_ANNOTATION_NAME],
        maxConcurrent: options.maxConcurrent,
      });
      attachTraceNotesToTraces(traces, traceNotes);

      const spanIds = traces
        .flatMap((trace) => trace.spans)
        .map((span) => span.context?.span_id)
        .filter((spanId): spanId is string => Boolean(spanId));

      const spanNotes = await fetchSpanAnnotations({
        client,
        projectIdentifier: projectId,
        spanIds,
        includeAnnotationNames: [NOTE_ANNOTATION_NAME],
        maxConcurrent: options.maxConcurrent,
      });
      for (const trace of traces) {
        attachSpanNotesToSpans(trace.spans, spanNotes);
      }
    }

    if (directory) {
      if (userSpecifiedFormat && options.format && options.format !== "json") {
        writeError({
          message: `Warning: --format is ignored when writing traces to a directory; writing JSON files to ${directory}`,
        });
      }

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
      const output = formatTracesOutput({ traces, format: options.format });
      writeOutput({ message: output });
    }
  } catch (error) {
    writeError({
      message: `Error fetching traces: ${error instanceof Error ? error.message : String(error)}`,
    });
    process.exit(getExitCodeForError(error));
  }
}

export function createTraceGetCommand(): Command {
  return new Command("get")
    .description("Fetch a specific trace by ID")
    .argument("<trace-id>", "Trace identifier (OTEL trace ID or prefix)")
    .option("--endpoint <url>", "Phoenix API endpoint")
    .option("--project <name>", "Project name or ID")
    .option("--api-key <key>", "Phoenix API key for authentication")
    .option(
      "--format <format>",
      "Output format: pretty, json, or raw",
      "pretty"
    )
    .option("--no-progress", "Disable progress indicators")
    .option("--file <path>", "Save trace to file instead of stdout")
    .option(
      "--include-annotations",
      "Include trace and span annotations in the trace export"
    )
    .option(
      "--include-notes",
      "Include trace and span notes in the trace export"
    )
    .action(traceGetHandler);
}

export function createTraceListCommand(): Command {
  return new Command("list")
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
      (v: string) => parseInt(v, 10),
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
      (v: string) => parseInt(v, 10),
      10
    )
    .option(
      "--include-annotations",
      "Include trace and span annotations in the trace export"
    )
    .option(
      "--include-notes",
      "Include trace and span notes in the trace export"
    )
    .action(traceListHandler);
}

/**
 * Handler for `trace annotate`
 */
async function traceAnnotateHandler(
  traceId: string,
  options: TraceAnnotateOptions
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

    const annotationInput = normalizeAnnotationInput({
      targetType: "trace",
      name: options.name,
      label: options.label,
      score: options.score,
      explanation: options.explanation,
      annotatorKind: options.annotatorKind,
    });

    const client = createPhoenixClient({ config });

    writeProgress({
      message: `Annotating trace ${traceId}...`,
      noProgress: !options.progress,
    });

    const response = await client.POST("/v1/trace_annotations", {
      params: {
        query: {
          sync: true,
        },
      },
      body: {
        data: [
          {
            trace_id: traceId,
            name: annotationInput.name,
            annotator_kind: annotationInput.annotatorKind,
            result: annotationInput.result,
            identifier: options.identifier ?? "",
          },
        ],
      },
    });

    if (response.error) {
      throw new Error(getResponseErrorMessage(response.error));
    }

    const insertedAnnotation = response.data?.data?.[0];
    if (!insertedAnnotation) {
      throw new Error(
        "Phoenix did not return the inserted trace annotation ID."
      );
    }

    const annotation = buildAnnotationMutationResult({
      id: insertedAnnotation.id,
      targetType: "trace",
      targetId: traceId,
      annotationInput,
      identifier: options.identifier,
    });

    const output = formatAnnotationMutationOutput({
      annotation,
      format: options.format,
    });
    writeOutput({ message: output });
  } catch (error) {
    writeError({
      message: `Error annotating trace: ${error instanceof Error ? error.message : String(error)}`,
    });
    process.exit(getExitCodeForError(error));
  }
}

export function createTraceAnnotateCommand(): Command {
  return new Command("annotate")
    .description("Annotate a trace by OpenTelemetry trace ID")
    .argument("<trace-id>", "OpenTelemetry trace ID")
    .option("--endpoint <url>", "Phoenix API endpoint")
    .option("--api-key <key>", "Phoenix API key for authentication")
    .option("--name <name>", "Annotation name")
    .option("--label <label>", "Annotation label")
    .option("--score <number>", "Annotation score")
    .option("--explanation <text>", "Annotation explanation")
    .option("--annotator-kind <kind>", "Annotation kind: HUMAN, LLM, or CODE")
    .option(
      "--identifier <string>",
      "Optional caller-supplied annotation identifier. Repeated calls with the same identifier overwrite the existing annotation. Default: empty string (server-side default)."
    )
    .option(
      "--format <format>",
      "Output format: pretty, json, or raw",
      "pretty"
    )
    .option("--no-progress", "Disable progress indicators")
    .addHelpText(
      "after",
      getAnnotationMutationHelpText({ targetType: "trace" })
    )
    .action(traceAnnotateHandler);
}

async function traceAddNoteHandler(
  traceId: string,
  options: TraceAddNoteOptions
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

    const noteText = normalizeNoteText({
      targetType: "trace",
      text: options.text,
    });
    const client = createPhoenixClient({ config });

    writeProgress({
      message: `Adding note to trace ${traceId}...`,
      noProgress: !options.progress,
    });

    const result = await addTraceNote({
      client,
      traceNote: {
        traceId,
        note: noteText,
        ...(options.identifier !== undefined && {
          identifier: options.identifier,
        }),
      },
    });

    const note = buildNoteMutationResult({
      id: result.id,
      targetType: "trace",
      targetId: traceId,
      text: noteText,
    });

    writeOutput({
      message: formatNoteMutationOutput({
        note,
        format: options.format,
      }),
    });
  } catch (error) {
    writeError({
      message: `Error adding trace note: ${error instanceof Error ? error.message : String(error)}`,
    });
    process.exit(getExitCodeForError(error));
  }
}

export function createTraceAddNoteCommand(): Command {
  return new Command("add-note")
    .description("Add a note to a trace by OpenTelemetry trace ID")
    .argument("<trace-id>", "OpenTelemetry trace ID")
    .option("--endpoint <url>", "Phoenix API endpoint")
    .option("--api-key <key>", "Phoenix API key for authentication")
    .option("--text <text>", "Note text")
    .option(
      "--identifier <string>",
      "Optional caller-supplied note identifier. Repeated calls with the same identifier overwrite the existing note. When omitted, the server stamps a unique 'px-trace-note:<uuid>' identifier so each call appends a new note."
    )
    .option(
      "--format <format>",
      "Output format: pretty, json, or raw",
      "pretty"
    )
    .option("--no-progress", "Disable progress indicators")
    .action(traceAddNoteHandler);
}

interface TraceDeleteOptions {
  endpoint?: string;
  apiKey?: string;
  yes?: boolean;
  progress?: boolean;
}

/**
 * Handler for `trace delete`
 */
async function traceDeleteHandler(
  traceIdentifier: string,
  options: TraceDeleteOptions
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
      message: `Delete trace ${traceIdentifier}? This will also delete all child spans. This cannot be undone.`,
      yes: options.yes,
    });

    writeProgress({
      message: `Deleting trace ${traceIdentifier}...`,
      noProgress: !options.progress,
    });

    const response = await client.DELETE("/v1/traces/{trace_identifier}", {
      params: {
        path: {
          trace_identifier: traceIdentifier,
        },
      },
    });

    if (response.error) {
      throw new Error(`Failed to delete trace: ${response.error}`);
    }

    writeProgress({
      message: `Deleted trace ${traceIdentifier}`,
      noProgress: !options.progress,
    });
  } catch (error) {
    writeError({
      message: `Error deleting trace: ${error instanceof Error ? error.message : String(error)}`,
    });
    process.exit(getExitCodeForError(error));
  }
}

export function createTraceDeleteCommand(): Command {
  return new Command("delete")
    .description("Delete a trace by identifier")
    .argument(
      "<trace-identifier>",
      "Trace identifier (OTel trace ID or GlobalID)"
    )
    .option("--endpoint <url>", "Phoenix API endpoint")
    .option("--api-key <key>", "Phoenix API key for authentication")
    .option("-y, --yes", "Skip confirmation prompt")
    .option("--no-progress", "Disable progress indicators")
    .action(traceDeleteHandler);
}

interface TraceListAnnotationsOptions {
  endpoint?: string;
  project?: string;
  apiKey?: string;
  format?: AnnotationListOutputFormat;
  progress?: boolean;
  identifier?: string[];
  traceIds?: string[];
  includeName?: string[];
  excludeName?: string[];
}

async function traceListAnnotationsHandler(
  options: TraceListAnnotationsOptions
): Promise<void> {
  // Pre-flight argument checks live OUTSIDE the try/catch so that
  // process.exit(INVALID_ARGUMENT) is not re-caught and re-mapped to
  // FAILURE by the catch's getExitCodeForError fallback.
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

  const projectIdentifier = config.project;
  if (!projectIdentifier) {
    writeError({ message: "Project not configured" });
    process.exit(ExitCode.INVALID_ARGUMENT);
  }

  const hasIdentifier =
    options.identifier !== undefined && options.identifier.length > 0;
  const hasTraceIds =
    options.traceIds !== undefined && options.traceIds.length > 0;
  if (!hasIdentifier && !hasTraceIds) {
    writeStructuredError({
      format: options.format,
      message:
        "Missing required filter: pass --identifier <id> or --trace-ids <id...> (the GET endpoint requires at least one).",
      code: "INVALID_ARGUMENT",
      hint: "px trace list-annotations --identifier <coding-session-id>",
    });
    process.exit(ExitCode.INVALID_ARGUMENT);
  }

  try {
    const client = createPhoenixClient({ config });

    writeProgress({
      message: `Resolving project: ${projectIdentifier}`,
      noProgress: !options.progress,
    });
    const projectId = await resolveProjectId({ client, projectIdentifier });

    writeProgress({
      message: "Fetching trace annotations...",
      noProgress: !options.progress,
    });

    const annotations = await fetchTraceAnnotations({
      client,
      projectIdentifier: projectId,
      traceIds: options.traceIds,
      identifier: options.identifier,
      includeAnnotationNames: options.includeName,
      excludeAnnotationNames: options.excludeName,
    });

    writeOutput({
      message: formatAnnotationListOutput({
        annotations,
        target: "trace",
        format: options.format,
      }),
    });
  } catch (error) {
    writeError({
      message: `Error listing trace annotations: ${error instanceof Error ? error.message : String(error)}`,
    });
    process.exit(getExitCodeForError(error));
  }
}

export function createTraceListAnnotationsCommand(): Command {
  return new Command("list-annotations")
    .description(
      "List trace annotations for the configured project, filtered by identifier and/or trace IDs"
    )
    .option("--endpoint <url>", "Phoenix API endpoint")
    .option("--project <name>", "Project name or ID")
    .option("--api-key <key>", "Phoenix API key for authentication")
    .option(
      "--identifier <ids...>",
      "Filter to annotations whose identifier matches one of these values (repeatable)"
    )
    .option(
      "--trace-ids <ids...>",
      "Filter to annotations attached to these trace IDs"
    )
    .option(
      "--include-name <name...>",
      'Include only annotations with these names (whitelist; e.g. "note" to fetch only open-coding notes, repeatable)'
    )
    .option("--exclude-name <name...>", "Exclude annotations with these names")
    .option(
      "--format <format>",
      "Output format: pretty, json, or raw",
      "pretty"
    )
    .option("--no-progress", "Disable progress indicators")
    .addHelpText(
      "after",
      "\nExamples:\n" +
        '  px trace list-annotations --identifier "$PHOENIX_CODING_SESSION_ID" --format raw --no-progress\n' +
        '  px trace list-annotations --identifier "$PHOENIX_CODING_SESSION_ID" --include-name note --format raw --no-progress\n'
    )
    .action(traceListAnnotationsHandler);
}

interface TraceDeleteAnnotationsOptions {
  endpoint?: string;
  project?: string;
  apiKey?: string;
  format?: AnnotationDeleteOutputFormat;
  progress?: boolean;
  yes?: boolean;
  identifier?: string;
  name?: string;
  annotatorKind?: string;
  startTime?: string;
  endTime?: string;
  all?: boolean;
}

async function traceDeleteAnnotationsHandler(
  options: TraceDeleteAnnotationsOptions
): Promise<void> {
  // Pre-flight checks live OUTSIDE the try/catch so explicit
  // process.exit(INVALID_ARGUMENT) is not re-mapped to FAILURE by the
  // catch's getExitCodeForError fallback.
  try {
    assertDeletesEnabled();
  } catch (error) {
    writeError({
      message: error instanceof Error ? error.message : String(error),
    });
    process.exit(getExitCodeForError(error));
  }

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

  const projectIdentifier = config.project;
  if (!projectIdentifier) {
    writeError({ message: "Project not configured" });
    process.exit(ExitCode.INVALID_ARGUMENT);
  }

  // Authorization gate per D3: require either --all or both
  // --start-time and --end-time. Other narrowers do NOT authorize the
  // request — match the server contract before we hit the wire.
  const hasWindow =
    options.startTime !== undefined && options.endTime !== undefined;
  if (!options.all && !hasWindow) {
    writeStructuredError({
      format: options.format,
      message:
        "Missing required authorization: pass --all to delete every matching row, or pass both --start-time and --end-time to bound the delete to a [start, end) window.",
      code: "INVALID_ARGUMENT",
      hint: 'px trace delete-annotations --identifier "$PHOENIX_CODING_SESSION_ID" --all',
    });
    process.exit(ExitCode.INVALID_ARGUMENT);
  }

  let annotatorKind: "HUMAN" | "LLM" | "CODE" | undefined;
  try {
    annotatorKind = normalizeAnnotatorKind(options.annotatorKind);
  } catch (error) {
    writeError({
      message: error instanceof Error ? error.message : String(error),
    });
    process.exit(ExitCode.INVALID_ARGUMENT);
  }

  try {
    const client = createPhoenixClient({ config });

    writeProgress({
      message: `Resolving project: ${projectIdentifier}`,
      noProgress: !options.progress,
    });
    const projectId = await resolveProjectId({ client, projectIdentifier });

    const promptMessage = options.all
      ? `Delete all matching trace annotations across all time?${describeNarrowers(options)}`
      : `Delete trace annotations between ${options.startTime} and ${options.endTime}?${describeNarrowers(options)}`;
    await confirmOrExit({ message: promptMessage, yes: options.yes });

    writeProgress({
      message: "Deleting trace annotations...",
      noProgress: !options.progress,
    });

    const response = await client.DELETE(
      "/v1/projects/{project_identifier}/trace_annotations",
      {
        params: {
          path: { project_identifier: projectId },
          query: {
            name: options.name,
            identifier: options.identifier,
            annotator_kind: annotatorKind,
            start_time: options.startTime,
            end_time: options.endTime,
            delete_all: options.all === true ? true : undefined,
          },
        },
      }
    );

    if (response.error) {
      throw new Error(`Failed to delete trace annotations: ${response.error}`);
    }

    const filter: AnnotationDeleteFilter = {
      ...(options.identifier !== undefined && {
        identifier: options.identifier,
      }),
      ...(options.name !== undefined && { name: options.name }),
      ...(annotatorKind !== undefined && { annotator_kind: annotatorKind }),
      ...(options.startTime !== undefined && { start_time: options.startTime }),
      ...(options.endTime !== undefined && { end_time: options.endTime }),
      ...(options.all === true && { all: true }),
    };

    writeOutput({
      message: formatAnnotationDeleteOutput({
        result: { deleted: true, target: "trace", filter },
        format: options.format,
      }),
    });
  } catch (error) {
    writeError({
      message: `Error deleting trace annotations: ${error instanceof Error ? error.message : String(error)}`,
    });
    process.exit(getExitCodeForError(error));
  }
}

export function createTraceDeleteAnnotationsCommand(): Command {
  return new Command("delete-annotations")
    .description(
      "Delete trace annotations for the configured project. Requires --all or both --start-time and --end-time."
    )
    .option("--endpoint <url>", "Phoenix API endpoint")
    .option("--project <name>", "Project name or ID")
    .option("--api-key <key>", "Phoenix API key for authentication")
    .option(
      "--identifier <id>",
      "Narrowing filter — only delete annotations with this identifier"
    )
    .option(
      "--name <name>",
      "Narrowing filter — only delete annotations with this name"
    )
    .option(
      "--annotator-kind <kind>",
      "Narrowing filter — annotator kind (HUMAN, LLM, or CODE)"
    )
    .option(
      "--start-time <iso>",
      "Inclusive lower bound on created_at (ISO-8601). Required together with --end-time unless --all is set."
    )
    .option(
      "--end-time <iso>",
      "Exclusive upper bound on created_at (ISO-8601). Required together with --start-time unless --all is set."
    )
    .option(
      "--all",
      "Authorize the delete without a time window (delete_all=true). Required if --start-time/--end-time are not set."
    )
    .option("-y, --yes", "Skip confirmation prompt")
    .option(
      "--format <format>",
      "Output format: pretty, json, or raw",
      "pretty"
    )
    .option("--no-progress", "Disable progress indicators")
    .addHelpText(
      "after",
      "\nExamples:\n" +
        '  px trace delete-annotations --identifier "$PHOENIX_CODING_SESSION_ID" --all -y\n' +
        "  px trace delete-annotations --start-time 2026-01-01T00:00:00Z --end-time 2026-01-02T00:00:00Z\n"
    )
    .action(traceDeleteAnnotationsHandler);
}

function normalizeAnnotatorKind(
  raw: string | undefined
): "HUMAN" | "LLM" | "CODE" | undefined {
  if (raw === undefined) return undefined;
  const value = raw.toUpperCase();
  if (value === "HUMAN" || value === "LLM" || value === "CODE") {
    return value;
  }
  throw new Error(
    `Invalid --annotator-kind: ${raw}. Expected one of HUMAN, LLM, CODE.`
  );
}

function describeNarrowers(options: {
  identifier?: string;
  name?: string;
  annotatorKind?: string;
}): string {
  const parts: string[] = [];
  if (options.identifier) parts.push(`identifier=${options.identifier}`);
  if (options.name) parts.push(`name=${options.name}`);
  if (options.annotatorKind)
    parts.push(`annotator_kind=${options.annotatorKind}`);
  return parts.length > 0 ? ` (${parts.join(", ")})` : "";
}

/**
 * Create the `trace` command with subcommands
 */
export function createTraceCommand(): Command {
  const command = new Command("trace");
  command.description("Manage Phoenix traces");
  command.addCommand(createTraceListCommand());
  command.addCommand(createTraceGetCommand());
  command.addCommand(createTraceAnnotateCommand());
  command.addCommand(createTraceAddNoteCommand());
  command.addCommand(createTraceListAnnotationsCommand());
  command.addCommand(createTraceDeleteAnnotationsCommand());
  command.addCommand(createTraceDeleteCommand());
  return command;
}
