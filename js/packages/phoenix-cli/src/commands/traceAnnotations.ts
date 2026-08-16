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
  formatAnnotationDeleteOutput,
  type AnnotationDeleteFilter,
} from "./formatAnnotationDelete";
import type { AnnotationsDeleteOptions } from "./options";

async function traceAnnotationsDeleteHandler(
  options: AnnotationsDeleteOptions
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

  // Require either --all or both --start-time and --end-time. Other
  // narrowers do not authorize the request; match the server contract before
  // hitting the wire.
  const hasWindow =
    options.startTime !== undefined && options.endTime !== undefined;
  if (!options.all && !hasWindow) {
    writeStructuredError({
      format: options.format,
      message:
        "Missing required authorization: pass --all to delete every matching row, or pass both --start-time and --end-time to bound the delete to a [start, end) window.",
      code: "INVALID_ARGUMENT",
      hint: 'px trace-annotations delete --identifier "$PHOENIX_CODING_IDENTIFIER" --all',
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

export function createTraceAnnotationsDeleteCommand(): Command {
  return new Command("delete")
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
        '  px trace-annotations delete --identifier "$PHOENIX_CODING_IDENTIFIER" --all -y\n' +
        "  px trace-annotations delete --start-time 2026-01-01T00:00:00Z --end-time 2026-01-02T00:00:00Z\n"
    )
    .action(traceAnnotationsDeleteHandler);
}

/**
 * Create the `trace-annotations` command group.
 */
export function createTraceAnnotationsCommand(): Command {
  const command = new Command("trace-annotations");
  command.description("Manage Phoenix trace annotations");
  command.addCommand(createTraceAnnotationsDeleteCommand());
  return command;
}
