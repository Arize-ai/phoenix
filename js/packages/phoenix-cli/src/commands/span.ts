import * as fs from "fs";
import type { componentsV1, PhoenixClient } from "@arizeai/phoenix-client";
import { addSpanNote } from "@arizeai/phoenix-client/spans";
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
import type { SpanWithAnnotations } from "../trace";
import {
  buildAnnotationMutationResult,
  getAnnotationMutationHelpText,
  getResponseErrorMessage,
  normalizeAnnotationInput,
} from "./annotationMutationUtils";
import {
  formatAnnotationMutationOutput,
  type OutputFormat as AnnotationMutationOutputFormat,
} from "./formatAnnotationMutation";
import {
  formatNoteMutationOutput,
  type OutputFormat as NoteMutationOutputFormat,
} from "./formatNoteMutation";
import {
  formatSpansOutput,
  type OutputFormat as SpanOutputFormat,
} from "./formatSpans";
import {
  buildNoteMutationResult,
  NOTE_ANNOTATION_NAME,
  normalizeNoteText,
} from "./noteMutationUtils";
import { fetchSpanAnnotations, type SpanAnnotation } from "./spanAnnotations";

type Span = componentsV1["schemas"]["Span"];

interface SpanListOptions {
  endpoint?: string;
  project?: string;
  apiKey?: string;
  format?: SpanOutputFormat;
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
  includeNotes?: boolean;
}

interface SpanAnnotateOptions {
  endpoint?: string;
  apiKey?: string;
  format?: AnnotationMutationOutputFormat;
  progress?: boolean;
  name?: string;
  label?: string;
  score?: string;
  explanation?: string;
  annotatorKind?: string;
}

interface SpanAddNoteOptions {
  endpoint?: string;
  apiKey?: string;
  format?: NoteMutationOutputFormat;
  progress?: boolean;
  text?: string;
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
 * Handler for `span list`
 */
async function spanListHandler(
  file: string | undefined,
  options: SpanListOptions
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
        excludeAnnotationNames: [NOTE_ANNOTATION_NAME],
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
    if (options.includeNotes) {
      writeProgress({
        message: "Fetching span notes...",
        noProgress: !options.progress,
      });

      const spanIds = spans
        .map((span) => span.context?.span_id)
        .filter((spanId): spanId is string => Boolean(spanId));

      const notes = await fetchSpanAnnotations({
        client,
        projectIdentifier: projectId,
        spanIds,
        includeAnnotationNames: [NOTE_ANNOTATION_NAME],
      });

      const notesBySpanId = new Map<string, SpanAnnotation[]>();
      for (const note of notes) {
        const spanId = note.span_id;
        if (!notesBySpanId.has(spanId)) {
          notesBySpanId.set(spanId, []);
        }
        notesBySpanId.get(spanId)!.push(note);
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
 * Create the `span list` command
 */
export function createSpanListCommand(): Command {
  return new Command("list")
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
      (v: string) => parseInt(v, 10),
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
    .option("--include-notes", "Include span notes in the output")
    .action(spanListHandler);
}

/**
 * Handler for `span annotate`
 */
async function spanAnnotateHandler(
  spanId: string,
  options: SpanAnnotateOptions
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
      targetType: "span",
      name: options.name,
      label: options.label,
      score: options.score,
      explanation: options.explanation,
      annotatorKind: options.annotatorKind,
    });

    const client = createPhoenixClient({ config });

    writeProgress({
      message: `Annotating span ${spanId}...`,
      noProgress: !options.progress,
    });

    const response = await client.POST("/v1/span_annotations", {
      params: {
        query: {
          sync: true,
        },
      },
      body: {
        data: [
          {
            span_id: spanId,
            name: annotationInput.name,
            annotator_kind: annotationInput.annotatorKind,
            result: annotationInput.result,
            identifier: "",
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
        "Phoenix did not return the inserted span annotation ID."
      );
    }

    const annotation = buildAnnotationMutationResult({
      id: insertedAnnotation.id,
      targetType: "span",
      targetId: spanId,
      annotationInput,
    });

    const output = formatAnnotationMutationOutput({
      annotation,
      format: options.format,
    });
    writeOutput({ message: output });
  } catch (error) {
    writeError({
      message: `Error annotating span: ${error instanceof Error ? error.message : String(error)}`,
    });
    process.exit(getExitCodeForError(error));
  }
}

export function createSpanAnnotateCommand(): Command {
  return new Command("annotate")
    .description("Annotate a span by OpenTelemetry span ID")
    .argument("<span-id>", "OpenTelemetry span ID")
    .option("--endpoint <url>", "Phoenix API endpoint")
    .option("--api-key <key>", "Phoenix API key for authentication")
    .option("--name <name>", "Annotation name")
    .option("--label <label>", "Annotation label")
    .option("--score <number>", "Annotation score")
    .option("--explanation <text>", "Annotation explanation")
    .option("--annotator-kind <kind>", "Annotation kind: HUMAN, LLM, or CODE")
    .option(
      "--format <format>",
      "Output format: pretty, json, or raw",
      "pretty"
    )
    .option("--no-progress", "Disable progress indicators")
    .addHelpText("after", getAnnotationMutationHelpText({ targetType: "span" }))
    .action(spanAnnotateHandler);
}

async function spanAddNoteHandler(
  spanId: string,
  options: SpanAddNoteOptions
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
      targetType: "span",
      text: options.text,
    });
    const client = createPhoenixClient({ config });

    writeProgress({
      message: `Adding note to span ${spanId}...`,
      noProgress: !options.progress,
    });

    const result = await addSpanNote({
      client,
      spanNote: {
        spanId,
        note: noteText,
      },
    });

    const note = buildNoteMutationResult({
      id: result.id,
      targetType: "span",
      targetId: spanId,
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
      message: `Error adding span note: ${error instanceof Error ? error.message : String(error)}`,
    });
    process.exit(getExitCodeForError(error));
  }
}

export function createSpanAddNoteCommand(): Command {
  return new Command("add-note")
    .description("Add a note to a span by OpenTelemetry span ID")
    .argument("<span-id>", "OpenTelemetry span ID")
    .option("--endpoint <url>", "Phoenix API endpoint")
    .option("--api-key <key>", "Phoenix API key for authentication")
    .option("--text <text>", "Note text")
    .option(
      "--format <format>",
      "Output format: pretty, json, or raw",
      "pretty"
    )
    .option("--no-progress", "Disable progress indicators")
    .action(spanAddNoteHandler);
}

interface SpanDeleteOptions {
  endpoint?: string;
  apiKey?: string;
  yes?: boolean;
  progress?: boolean;
}

/**
 * Handler for `span delete`
 */
async function spanDeleteHandler(
  spanIdentifier: string,
  options: SpanDeleteOptions
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
      message: `Delete span ${spanIdentifier}? Child spans will NOT be deleted. This cannot be undone.`,
      yes: options.yes,
    });

    writeProgress({
      message: `Deleting span ${spanIdentifier}...`,
      noProgress: !options.progress,
    });

    const response = await client.DELETE("/v1/spans/{span_identifier}", {
      params: {
        path: {
          span_identifier: spanIdentifier,
        },
      },
    });

    if (response.error) {
      throw new Error(`Failed to delete span: ${response.error}`);
    }

    writeProgress({
      message: `Deleted span ${spanIdentifier}`,
      noProgress: !options.progress,
    });
  } catch (error) {
    writeError({
      message: `Error deleting span: ${error instanceof Error ? error.message : String(error)}`,
    });
    process.exit(getExitCodeForError(error));
  }
}

export function createSpanDeleteCommand(): Command {
  return new Command("delete")
    .description("Delete a span by identifier")
    .argument("<span-identifier>", "Span identifier (OTel span_id or GlobalID)")
    .option("--endpoint <url>", "Phoenix API endpoint")
    .option("--api-key <key>", "Phoenix API key for authentication")
    .option("-y, --yes", "Skip confirmation prompt")
    .option("--no-progress", "Disable progress indicators")
    .action(spanDeleteHandler);
}

/**
 * Create the `span` command with subcommands
 */
export function createSpanCommand(): Command {
  const command = new Command("span");
  command.description("Manage Phoenix spans");
  command.addCommand(createSpanListCommand());
  command.addCommand(createSpanAnnotateCommand());
  command.addCommand(createSpanAddNoteCommand());
  command.addCommand(createSpanDeleteCommand());
  return command;
}
