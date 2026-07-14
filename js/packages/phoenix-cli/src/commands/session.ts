import * as fs from "fs";
import type { componentsV1, PhoenixClient } from "@arizeai/phoenix-client";
import {
  addSessionAnnotation,
  addSessionNote,
  deleteSession,
} from "@arizeai/phoenix-client/sessions";
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
import {
  buildAnnotationMutationResult,
  getAnnotationMutationHelpText,
  normalizeAnnotationInput,
} from "./annotationMutations";
import { chunkArray } from "./chunkArray";
import { formatAnnotationMutationOutput } from "./formatAnnotationMutation";
import { formatNoteMutationOutput } from "./formatNoteMutation";
import {
  formatSessionOutput,
  formatSessionsOutput,
  type OutputFormat as SessionOutputFormat,
  type SessionNote,
  type SessionWithAnnotations,
} from "./formatSessions";
import {
  buildNoteMutationResult,
  NOTE_ANNOTATION_NAME,
  normalizeNoteText,
} from "./noteMutations";
import type {
  AddNoteOptions,
  AnnotationInclusionOptions,
  AnnotateOptions,
  DeleteOptions,
  ProjectScopedOptions,
} from "./options";

type SessionData = componentsV1["schemas"]["SessionData"];
type SessionAnnotation = componentsV1["schemas"]["SessionAnnotation"];

const DEFAULT_PAGE_LIMIT = 1000;
const DEFAULT_SESSION_IDS_CHUNK_SIZE = 100;
const DEFAULT_MAX_CONCURRENT = 5;

/**
 * Options for `px session get`.
 */
interface SessionGetOptions
  extends
    ProjectScopedOptions<SessionOutputFormat>,
    AnnotationInclusionOptions {
  /**
   * `--file <path>`: Write the session to this file as JSON instead of
   * stdout. When set, `--format` is ignored (a warning is printed if the
   * user also passed a non-`json` `--format`).
   *
   * @example "./session.json"
   */
  file?: string;
}

/**
 * Options for `px session list`.
 */
interface SessionListOptions
  extends
    ProjectScopedOptions<SessionOutputFormat>,
    AnnotationInclusionOptions {
  /**
   * `-n, --limit <number>`: Maximum number of sessions to return. Defaults
   * to 10.
   *
   * @example 50
   */
  limit?: number;
  /**
   * `--order <order>`: Sort order for sessions — `asc` or `desc`. Defaults
   * to `desc` (newest first).
   *
   * @example "asc"
   */
  order?: "asc" | "desc";
}

/**
 * Fetch a single session by identifier
 */
async function fetchSession({
  client,
  sessionIdentifier,
}: {
  client: PhoenixClient;
  sessionIdentifier: string;
}): Promise<SessionData> {
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
 * Fetch annotations for a session by `sessionIds` (chunked + paginated).
 */
async function fetchSessionAnnotations({
  client,
  projectIdentifier,
  sessionIds,
  includeAnnotationNames,
  excludeAnnotationNames,
  pageLimit = DEFAULT_PAGE_LIMIT,
  maxConcurrent = DEFAULT_MAX_CONCURRENT,
}: {
  client: PhoenixClient;
  projectIdentifier: string;
  sessionIds: string[];
  includeAnnotationNames?: string[];
  excludeAnnotationNames?: string[];
  pageLimit?: number;
  maxConcurrent?: number;
}): Promise<SessionAnnotation[]> {
  if (sessionIds.length === 0) {
    return [];
  }

  const uniqueSessionIds = Array.from(new Set(sessionIds));
  const chunks = chunkArray({
    items: uniqueSessionIds,
    size: DEFAULT_SESSION_IDS_CHUNK_SIZE,
  });
  const allAnnotations: SessionAnnotation[] = [];

  for (let index = 0; index < chunks.length; index += maxConcurrent) {
    const batch = chunks.slice(index, index + maxConcurrent);
    const batchResults = await Promise.all(
      batch.map((sessionIdsChunk) =>
        fetchSessionAnnotationsForChunk({
          client,
          projectIdentifier,
          sessionIds: sessionIdsChunk,
          includeAnnotationNames,
          excludeAnnotationNames,
          pageLimit,
        })
      )
    );

    for (const result of batchResults) {
      allAnnotations.push(...result);
    }
  }

  return allAnnotations;
}

async function fetchSessionAnnotationsForChunk({
  client,
  projectIdentifier,
  sessionIds,
  includeAnnotationNames,
  excludeAnnotationNames,
  pageLimit,
}: {
  client: PhoenixClient;
  projectIdentifier: string;
  sessionIds: string[];
  includeAnnotationNames?: string[];
  excludeAnnotationNames?: string[];
  pageLimit: number;
}): Promise<SessionAnnotation[]> {
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
            session_ids: sessionIds,
            include_annotation_names: includeAnnotationNames,
            exclude_annotation_names: excludeAnnotationNames,
            cursor,
            limit: pageLimit,
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

function buildSessionNote(annotation: SessionAnnotation): SessionNote {
  return {
    ...annotation,
    name: NOTE_ANNOTATION_NAME,
    result:
      annotation.result == null
        ? annotation.result
        : { explanation: annotation.result.explanation ?? null },
  };
}

function attachSessionAnnotations({
  sessions,
  annotations,
}: {
  sessions: SessionWithAnnotations[];
  annotations: SessionAnnotation[];
}): void {
  const annotationsBySessionId = new Map<string, SessionAnnotation[]>();
  for (const annotation of annotations) {
    const annotationSessionId = annotation.session_id;
    if (!annotationsBySessionId.has(annotationSessionId)) {
      annotationsBySessionId.set(annotationSessionId, []);
    }
    annotationsBySessionId.get(annotationSessionId)!.push(annotation);
  }

  for (const session of sessions) {
    const sessionAnnotations = annotationsBySessionId.get(session.session_id);
    if (sessionAnnotations) {
      session.annotations = sessionAnnotations;
    }
  }
}

function attachSessionNotes({
  sessions,
  notes,
}: {
  sessions: SessionWithAnnotations[];
  notes: SessionAnnotation[];
}): void {
  const notesBySessionId = new Map<string, SessionNote[]>();
  for (const note of notes) {
    const noteSessionId = note.session_id;
    if (!notesBySessionId.has(noteSessionId)) {
      notesBySessionId.set(noteSessionId, []);
    }
    notesBySessionId.get(noteSessionId)!.push(buildSessionNote(note));
  }

  for (const session of sessions) {
    const sessionNotes = notesBySessionId.get(session.session_id);
    if (sessionNotes) {
      session.notes = sessionNotes;
    }
  }
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
    const validation = validateConfig({ config, projectRequired: false });
    if (!validation.valid) {
      writeError({
        message: getConfigErrorMessage({ errors: validation.errors }),
      });
      process.exit(ExitCode.INVALID_ARGUMENT);
    }

    // Create client
    const client = createPhoenixClient({ config });

    writeProgress({
      message: `Fetching session ${sessionId}...`,
      noProgress: !options.progress,
    });

    // Fetch session
    const session = await fetchSession({
      client,
      sessionIdentifier: sessionId,
    });

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

      annotations = await fetchSessionAnnotations({
        client,
        projectIdentifier: session.project_id,
        sessionIds: [session.session_id],
        excludeAnnotationNames: [NOTE_ANNOTATION_NAME],
      });

      writeProgress({
        message: `Found ${annotations.length} annotation(s)`,
        noProgress: !options.progress,
      });
    }

    let notes: SessionNote[] | undefined;
    if (options.includeNotes) {
      writeProgress({
        message: "Fetching session notes...",
        noProgress: !options.progress,
      });

      const noteAnnotations = await fetchSessionAnnotations({
        client,
        projectIdentifier: session.project_id,
        sessionIds: [session.session_id],
        includeAnnotationNames: [NOTE_ANNOTATION_NAME],
      });
      notes = noteAnnotations.map(buildSessionNote);

      writeProgress({
        message: `Found ${notes.length} note(s)`,
        noProgress: !options.progress,
      });
    }

    // Determine output format
    const outputFormat: SessionOutputFormat = options.file
      ? "json"
      : options.format || "pretty";

    if (options.file && userSpecifiedFormat && options.format !== "json") {
      writeError({
        message: `Warning: --format is ignored when writing to a file; writing JSON to ${options.file}`,
      });
    }

    const sessionWithAnnotations: SessionWithAnnotations = {
      ...session,
      ...(annotations ? { annotations } : {}),
      ...(notes ? { notes } : {}),
    };

    // Format output
    const output = formatSessionOutput({
      session: sessionWithAnnotations,
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

    const sessions: SessionWithAnnotations[] = await fetchSessions(
      client,
      projectId,
      {
        limit,
        order: options.order,
      }
    );

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

    const sessionIds = sessions.map((session) => session.session_id);
    if (options.includeAnnotations) {
      writeProgress({
        message: "Fetching session annotations...",
        noProgress: !options.progress,
      });

      const annotations = await fetchSessionAnnotations({
        client,
        projectIdentifier: projectId,
        sessionIds,
        excludeAnnotationNames: [NOTE_ANNOTATION_NAME],
      });
      attachSessionAnnotations({ sessions, annotations });
    }

    if (options.includeNotes) {
      writeProgress({
        message: "Fetching session notes...",
        noProgress: !options.progress,
      });

      const notes = await fetchSessionAnnotations({
        client,
        projectIdentifier: projectId,
        sessionIds,
        includeAnnotationNames: [NOTE_ANNOTATION_NAME],
      });
      attachSessionNotes({ sessions, notes });
    }

    const output = formatSessionsOutput({
      sessions,
      format: options.format,
      includeAnnotations: options.includeAnnotations,
      includeNotes: options.includeNotes,
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
    .option("--include-notes", "Include session notes")
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
    .option("--include-annotations", "Include session annotations")
    .option("--include-notes", "Include session notes")
    .option(
      "-n, --limit <number>",
      "Maximum number of sessions to return",
      (v: string) => parseInt(v, 10),
      10
    )
    .option("--order <order>", "Sort order: asc or desc", "desc")
    .action(sessionListHandler);
}

async function sessionAnnotateHandler(
  sessionId: string,
  options: AnnotateOptions
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
      targetType: "session",
      name: options.name,
      label: options.label,
      score: options.score,
      explanation: options.explanation,
      annotatorKind: options.annotatorKind,
    });

    const client = createPhoenixClient({ config });

    writeProgress({
      message: `Resolving session ${sessionId}...`,
      noProgress: !options.progress,
    });

    const session = await fetchSession({
      client,
      sessionIdentifier: sessionId,
    });

    writeProgress({
      message: `Annotating session ${session.session_id}...`,
      noProgress: !options.progress,
    });

    const result = await addSessionAnnotation({
      client,
      sync: true,
      sessionAnnotation: {
        sessionId: session.session_id,
        name: annotationInput.name,
        label: annotationInput.label ?? undefined,
        score: annotationInput.score ?? undefined,
        explanation: annotationInput.explanation ?? undefined,
        annotatorKind: annotationInput.annotatorKind,
        identifier: options.identifier ?? "",
      },
    });

    if (!result?.id) {
      throw new Error("Failed to add session annotation: no data returned");
    }

    const output = formatAnnotationMutationOutput({
      annotation: buildAnnotationMutationResult({
        id: result.id,
        targetType: "session",
        targetId: session.session_id,
        annotationInput,
        identifier: options.identifier,
      }),
      format: options.format,
    });
    writeOutput({ message: output });
  } catch (error) {
    writeError({
      message: `Error annotating session: ${error instanceof Error ? error.message : String(error)}`,
    });
    process.exit(getExitCodeForError(error));
  }
}

export function createSessionAnnotateCommand(): Command {
  return new Command("annotate")
    .description("Add or update an annotation on a session")
    .argument(
      "<session-id>",
      "Session identifier (GlobalID or user-provided session_id)"
    )
    .option("--endpoint <url>", "Phoenix API endpoint")
    .option("--api-key <key>", "Phoenix API key for authentication")
    .option("--name <name>", "Annotation name")
    .option("--label <label>", "Annotation label")
    .option("--score <number>", "Annotation score")
    .option("--explanation <text>", "Annotation explanation")
    .option(
      "--annotator-kind <kind>",
      "Annotator kind: HUMAN, LLM, or CODE",
      "HUMAN"
    )
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
      getAnnotationMutationHelpText({ targetType: "session" })
    )
    .action(sessionAnnotateHandler);
}

async function sessionAddNoteHandler(
  sessionId: string,
  options: AddNoteOptions
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

    const text = normalizeNoteText({
      targetType: "session",
      text: options.text,
    });

    const client = createPhoenixClient({ config });

    writeProgress({
      message: `Resolving session ${sessionId}...`,
      noProgress: !options.progress,
    });

    const session = await fetchSession({
      client,
      sessionIdentifier: sessionId,
    });

    writeProgress({
      message: `Adding note to session ${session.session_id}...`,
      noProgress: !options.progress,
    });

    const result = await addSessionNote({
      client,
      sessionNote: {
        sessionId: session.session_id,
        note: text,
        ...(options.identifier !== undefined && {
          identifier: options.identifier,
        }),
      },
    });

    const output = formatNoteMutationOutput({
      note: buildNoteMutationResult({
        id: result.id,
        targetType: "session",
        targetId: session.session_id,
        text,
      }),
      format: options.format,
    });
    writeOutput({ message: output });
  } catch (error) {
    writeError({
      message: `Error adding session note: ${error instanceof Error ? error.message : String(error)}`,
    });
    process.exit(getExitCodeForError(error));
  }
}

export function createSessionAddNoteCommand(): Command {
  return new Command("add-note")
    .description("Add a note to a session")
    .argument(
      "<session-id>",
      "Session identifier (GlobalID or user-provided session_id)"
    )
    .option("--endpoint <url>", "Phoenix API endpoint")
    .option("--api-key <key>", "Phoenix API key for authentication")
    .option("--text <text>", "Note text")
    .option(
      "--identifier <string>",
      "Optional caller-supplied note identifier. Repeated calls with the same identifier overwrite the existing note. When omitted, the server stamps a unique 'px-session-note:<uuid>' identifier so each call appends a new note."
    )
    .option(
      "--format <format>",
      "Output format: pretty, json, or raw",
      "pretty"
    )
    .option("--no-progress", "Disable progress indicators")
    .action(sessionAddNoteHandler);
}

/**
 * Handler for `session delete`
 */
async function sessionDeleteHandler(
  sessionId: string,
  options: DeleteOptions
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
      message: `Delete session ${sessionId}? This will also delete all traces, spans, and annotations. This cannot be undone.`,
      yes: options.yes,
    });

    await deleteSession({ client, sessionId });

    writeProgress({
      message: `Deleted session ${sessionId}`,
      noProgress: !options.progress,
    });
  } catch (error) {
    writeError({
      message: `Error deleting session: ${error instanceof Error ? error.message : String(error)}`,
    });
    process.exit(getExitCodeForError(error));
  }
}

export function createSessionDeleteCommand(): Command {
  return new Command("delete")
    .description("Delete a session by ID")
    .argument(
      "<session-id>",
      "Session identifier (GlobalID or user-provided session_id)"
    )
    .option("--endpoint <url>", "Phoenix API endpoint")
    .option("--api-key <key>", "Phoenix API key for authentication")
    .option("-y, --yes", "Skip confirmation prompt")
    .option("--no-progress", "Disable progress indicators")
    .action(sessionDeleteHandler);
}

/**
 * Create the `session` command with subcommands
 */
export function createSessionCommand(): Command {
  const command = new Command("session");
  command.description("Manage Phoenix sessions");
  command.addCommand(createSessionListCommand());
  command.addCommand(createSessionGetCommand());
  command.addCommand(createSessionAnnotateCommand());
  command.addCommand(createSessionAddNoteCommand());
  command.addCommand(createSessionDeleteCommand());
  return command;
}
