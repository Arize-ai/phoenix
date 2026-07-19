import type { componentsV1 } from "@arizeai/phoenix-testing";
import { HttpResponse } from "@arizeai/phoenix-testing";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createSessionCommand } from "../src/commands/session";
import { ExitCode } from "../src/exitCodes";
import { http, setupMockPhoenixServer } from "./mockServer";
import { BASE_ARGS, captureCliOutput, mockProcessExit } from "./testUtils";

const mock = setupMockPhoenixServer();

const SESSION_FIXTURE: componentsV1["schemas"]["SessionData"] = {
  id: "U2Vzc2lvbjox",
  session_id: "session-123",
  project_id: "project-default",
  start_time: "2026-01-13T10:00:00.000Z",
  end_time: "2026-01-13T10:01:00.000Z",
  traces: [],
};

const SESSION_ANNOTATION_FIXTURE: componentsV1["schemas"]["SessionAnnotation"] =
  {
    id: "session-annotation-1",
    created_at: "2026-01-13T10:00:00.500Z",
    updated_at: "2026-01-13T10:00:00.500Z",
    source: "API",
    user_id: null,
    name: "reviewer",
    annotator_kind: "HUMAN",
    result: {
      label: "pass",
    },
    metadata: null,
    identifier: "",
    session_id: "session-123",
  };

const SESSION_NOTE_FIXTURE: componentsV1["schemas"]["SessionAnnotation"] = {
  id: "session-note-1",
  created_at: "2026-01-13T10:00:00.750Z",
  updated_at: "2026-01-13T10:00:00.750Z",
  source: "API",
  user_id: null,
  name: "note",
  annotator_kind: "HUMAN",
  result: {
    explanation: "session note text",
  },
  metadata: null,
  identifier: "px-session-note:1",
  session_id: "session-123",
};

/**
 * Answer session lookups with the standard session fixture and record how
 * many lookups happened and the last identifier requested.
 */
function useSessionLookup() {
  const captured: { count: number; sessionIdentifier?: string } = { count: 0 };
  mock.server.use(
    http.get("/v1/sessions/{session_identifier}", ({ params, response }) => {
      captured.count += 1;
      captured.sessionIdentifier = params.session_identifier;
      return response(200).json({ data: SESSION_FIXTURE });
    })
  );
  return captured;
}

/**
 * Report the given Phoenix server version. The endpoint returns the version
 * string as plain text, which is not expressible via the typed JSON helper.
 */
function useServerVersion(version: string) {
  const captured = { count: 0 };
  mock.server.use(
    http.get("/arize_phoenix_version", ({ response }) => {
      captured.count += 1;
      return response.untyped(new Response(version, { status: 200 }));
    })
  );
  return captured;
}

/** Pin project-name resolution to a stable project ID. */
function useProjectResolution() {
  mock.server.use(
    http.get("/v1/projects/{project_identifier}", ({ response }) =>
      response(200).json({
        data: { id: "project-default", name: "default" },
      })
    )
  );
}

/**
 * Answer session-annotation reads, serving `notes` when the request filters
 * to the note annotation name and `annotations` otherwise. Records each
 * request's project identifier and query string in arrival order.
 */
function useSessionAnnotationReads({
  annotations = [],
  notes = [],
}: {
  annotations?: componentsV1["schemas"]["SessionAnnotation"][];
  notes?: componentsV1["schemas"]["SessionAnnotation"][];
} = {}) {
  const captured: {
    projectIdentifiers: string[];
    queries: URLSearchParams[];
  } = { projectIdentifiers: [], queries: [] };

  mock.server.use(
    http.get(
      "/v1/projects/{project_identifier}/session_annotations",
      ({ params, request, response }) => {
        const query = new URL(request.url).searchParams;
        captured.projectIdentifiers.push(params.project_identifier);
        captured.queries.push(query);
        const isNoteRead = query
          .getAll("include_annotation_names")
          .includes("note");
        return response(200).json({
          data: isNoteRead ? notes : annotations,
          next_cursor: null,
        });
      }
    )
  );

  return captured;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("session annotate", () => {
  it("resolves a session and posts a sync session annotation", async () => {
    const sessionLookup = useSessionLookup();
    useServerVersion("14.17.0");
    const posted: { query?: URLSearchParams; body?: unknown } = {};
    mock.server.use(
      http.post("/v1/session_annotations", async ({ request, response }) => {
        posted.query = new URL(request.url).searchParams;
        posted.body = await request.clone().json();
        return response(200).json({
          data: [{ id: "session-annotation-1" }],
        });
      })
    );
    const io = captureCliOutput();

    await createSessionCommand().parseAsync(
      [
        "annotate",
        "U2Vzc2lvbjox",
        "--name",
        " reviewer ",
        "--label",
        " pass ",
        "--format",
        "raw",
        ...BASE_ARGS,
      ],
      { from: "user" }
    );

    expect(sessionLookup.sessionIdentifier).toBe("U2Vzc2lvbjox");
    expect(posted.query?.get("sync")).toBe("true");
    expect(posted.body).toEqual({
      data: [
        {
          session_id: "session-123",
          name: "reviewer",
          annotator_kind: "HUMAN",
          result: { label: "pass" },
          metadata: null,
          identifier: "",
        },
      ],
    });
    expect(io.stdout).toHaveBeenCalledWith(
      JSON.stringify({
        id: "session-annotation-1",
        targetType: "session",
        targetId: "session-123",
        name: "reviewer",
        label: "pass",
        score: null,
        explanation: null,
        annotatorKind: "HUMAN",
        identifier: "",
      })
    );
  });

  it("validates missing annotation names before network calls", async () => {
    const sessionLookup = useSessionLookup();
    const stderrSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const exitSpy = mockProcessExit();

    await expect(
      createSessionCommand().parseAsync(
        ["annotate", "session-123", "--label", "pass", ...BASE_ARGS],
        { from: "user" }
      )
    ).rejects.toThrow(`process.exit:${ExitCode.INVALID_ARGUMENT}`);

    expect(exitSpy).toHaveBeenCalledWith(ExitCode.INVALID_ARGUMENT);
    expect(sessionLookup.count).toBe(0);
    expect(stderrSpy).toHaveBeenCalledWith(
      expect.stringContaining("Missing required flag --name.")
    );
  });

  it("validates invalid scores before network calls", async () => {
    const sessionLookup = useSessionLookup();
    const stderrSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const exitSpy = mockProcessExit();

    await expect(
      createSessionCommand().parseAsync(
        [
          "annotate",
          "session-123",
          "--name",
          "score",
          "--score",
          "nope",
          ...BASE_ARGS,
        ],
        { from: "user" }
      )
    ).rejects.toThrow(`process.exit:${ExitCode.INVALID_ARGUMENT}`);

    expect(exitSpy).toHaveBeenCalledWith(ExitCode.INVALID_ARGUMENT);
    expect(sessionLookup.count).toBe(0);
    expect(stderrSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        "Invalid value for --score: nope. Expected a finite number."
      )
    );
  });

  it("validates empty annotation results before network calls", async () => {
    const sessionLookup = useSessionLookup();
    const stderrSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const exitSpy = mockProcessExit();

    await expect(
      createSessionCommand().parseAsync(
        ["annotate", "session-123", "--name", "reviewer", ...BASE_ARGS],
        { from: "user" }
      )
    ).rejects.toThrow(`process.exit:${ExitCode.INVALID_ARGUMENT}`);

    expect(exitSpy).toHaveBeenCalledWith(ExitCode.INVALID_ARGUMENT);
    expect(sessionLookup.count).toBe(0);
    expect(stderrSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        "At least one of --label, --score, or --explanation must be provided."
      )
    );
  });

  it("validates invalid annotator kinds before network calls", async () => {
    const sessionLookup = useSessionLookup();
    const stderrSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const exitSpy = mockProcessExit();

    await expect(
      createSessionCommand().parseAsync(
        [
          "annotate",
          "session-123",
          "--name",
          "reviewer",
          "--label",
          "pass",
          "--annotator-kind",
          "bot",
          ...BASE_ARGS,
        ],
        { from: "user" }
      )
    ).rejects.toThrow(`process.exit:${ExitCode.INVALID_ARGUMENT}`);

    expect(exitSpy).toHaveBeenCalledWith(ExitCode.INVALID_ARGUMENT);
    expect(sessionLookup.count).toBe(0);
    expect(stderrSpy).toHaveBeenCalledWith(
      expect.stringContaining("Invalid value for --annotator-kind: bot")
    );
  });

  it("reports API errors from session annotation", async () => {
    useSessionLookup();
    useServerVersion("14.17.0");
    mock.server.use(
      // 400 is not part of the OpenAPI spec for this operation.
      http.post("/v1/session_annotations", ({ response }) =>
        response.untyped(
          HttpResponse.json(
            { detail: "The name 'note' is reserved for session notes." },
            { status: 400 }
          )
        )
      )
    );
    const stderrSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const exitSpy = mockProcessExit();

    await expect(
      createSessionCommand().parseAsync(
        [
          "annotate",
          "session-123",
          "--name",
          "note",
          "--label",
          "pass",
          ...BASE_ARGS,
        ],
        { from: "user" }
      )
    ).rejects.toThrow();

    expect(exitSpy).toHaveBeenCalled();
    expect(stderrSpy).toHaveBeenCalledWith(
      expect.stringContaining("Error annotating session:")
    );
  });
});

describe("session add-note", () => {
  it("resolves a session and posts a session note", async () => {
    const sessionLookup = useSessionLookup();
    const serverVersion = useServerVersion("14.17.0");
    const posted: { body?: unknown } = {};
    mock.server.use(
      http.post("/v1/session_notes", async ({ request, response }) => {
        posted.body = await request.clone().json();
        return response(200).json({ data: { id: "session-note-1" } });
      })
    );
    const io = captureCliOutput();

    await createSessionCommand().parseAsync(
      [
        "add-note",
        "U2Vzc2lvbjox",
        "--text",
        "  needs review  ",
        "--format",
        "raw",
        ...BASE_ARGS,
      ],
      { from: "user" }
    );

    expect(sessionLookup.sessionIdentifier).toBe("U2Vzc2lvbjox");
    expect(serverVersion.count).toBe(1);
    expect(posted.body).toEqual({
      data: {
        session_id: "session-123",
        note: "needs review",
      },
    });
    expect(io.stdout).toHaveBeenCalledWith(
      JSON.stringify({
        id: "session-note-1",
        targetType: "session",
        targetId: "session-123",
        text: "needs review",
      })
    );
  });

  it("validates blank note text before network calls", async () => {
    const sessionLookup = useSessionLookup();
    const stderrSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const exitSpy = mockProcessExit();

    await expect(
      createSessionCommand().parseAsync(
        ["add-note", "session-123", "--text", "   ", ...BASE_ARGS],
        { from: "user" }
      )
    ).rejects.toThrow(`process.exit:${ExitCode.INVALID_ARGUMENT}`);

    expect(exitSpy).toHaveBeenCalledWith(ExitCode.INVALID_ARGUMENT);
    expect(sessionLookup.count).toBe(0);
    expect(stderrSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        "Invalid value for --text: <empty>. Expected non-empty text."
      )
    );
  });

  it("fails fast on older Phoenix servers", async () => {
    useSessionLookup();
    useServerVersion("14.16.0");
    let noteRequestCount = 0;
    mock.server.use(
      http.post("/v1/session_notes", ({ response }) => {
        noteRequestCount += 1;
        return response(200).json({ data: { id: "unreachable" } });
      })
    );
    const stderrSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const exitSpy = mockProcessExit();

    await expect(
      createSessionCommand().parseAsync(
        [
          "add-note",
          "session-123",
          "--text",
          "needs review",
          "--format",
          "raw",
          ...BASE_ARGS,
        ],
        { from: "user" }
      )
    ).rejects.toThrow();

    expect(exitSpy).toHaveBeenCalled();
    expect(noteRequestCount).toBe(0);
    expect(stderrSpy).toHaveBeenCalledWith(
      expect.stringContaining("requires Phoenix server >= 14.17.0")
    );
  });
});

describe("session annotation and note readback", () => {
  it("includes notes in session get raw output when requested", async () => {
    useSessionLookup();
    const annotationReads = useSessionAnnotationReads({
      notes: [SESSION_NOTE_FIXTURE],
    });
    const io = captureCliOutput();

    await createSessionCommand().parseAsync(
      [
        "get",
        "session-123",
        "--include-notes",
        "--format",
        "raw",
        ...BASE_ARGS,
      ],
      { from: "user" }
    );

    expect(annotationReads.projectIdentifiers).toEqual(["project-default"]);
    expect(
      annotationReads.queries[0]?.getAll("include_annotation_names")
    ).toEqual(["note"]);

    const output = io.stdout.mock.calls[0]?.[0];
    const parsedOutput = JSON.parse(String(output));
    expect(parsedOutput.session.notes).toEqual([
      expect.objectContaining({ id: "session-note-1", name: "note" }),
    ]);
    expect(parsedOutput.notes).toBeUndefined();
  });

  it("excludes notes from session get annotations", async () => {
    useSessionLookup();
    const annotationReads = useSessionAnnotationReads({
      annotations: [SESSION_ANNOTATION_FIXTURE],
    });
    const io = captureCliOutput();

    await createSessionCommand().parseAsync(
      [
        "get",
        "session-123",
        "--include-annotations",
        "--format",
        "raw",
        ...BASE_ARGS,
      ],
      { from: "user" }
    );

    expect(
      annotationReads.queries[0]?.getAll("exclude_annotation_names")
    ).toEqual(["note"]);

    const output = io.stdout.mock.calls[0]?.[0];
    const parsedOutput = JSON.parse(String(output));
    expect(parsedOutput.session.annotations).toEqual([
      expect.objectContaining({ id: "session-annotation-1", name: "reviewer" }),
    ]);
    expect(parsedOutput.annotations).toBeUndefined();
    expect(parsedOutput.session.annotations).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ name: "note" })])
    );
  });

  it("renders requested empty annotation and note columns in session list pretty output", async () => {
    useProjectResolution();
    mock.server.use(
      http.get("/v1/projects/{project_identifier}/sessions", ({ response }) =>
        response(200).json({ data: [SESSION_FIXTURE], next_cursor: null })
      )
    );
    useSessionAnnotationReads();
    const io = captureCliOutput();

    await createSessionCommand().parseAsync(
      [
        "list",
        "--project",
        "default",
        "--include-annotations",
        "--include-notes",
        ...BASE_ARGS,
      ],
      { from: "user" }
    );

    const output = String(io.stdout.mock.calls[0]?.[0]);
    expect(output).toContain("annotations");
    expect(output).toContain("notes");
  });

  it("includes annotations and notes in session list raw output", async () => {
    useProjectResolution();
    mock.server.use(
      http.get("/v1/projects/{project_identifier}/sessions", ({ response }) =>
        response(200).json({ data: [SESSION_FIXTURE], next_cursor: null })
      )
    );
    const annotationReads = useSessionAnnotationReads({
      annotations: [SESSION_ANNOTATION_FIXTURE],
      notes: [SESSION_NOTE_FIXTURE],
    });
    const io = captureCliOutput();

    await createSessionCommand().parseAsync(
      [
        "list",
        "--project",
        "default",
        "--include-annotations",
        "--include-notes",
        "--format",
        "raw",
        ...BASE_ARGS,
      ],
      { from: "user" }
    );

    const annotationsQuery = annotationReads.queries[0];
    const notesQuery = annotationReads.queries[1];
    expect(annotationsQuery?.getAll("session_ids")).toEqual(["session-123"]);
    expect(annotationsQuery?.getAll("exclude_annotation_names")).toEqual([
      "note",
    ]);
    expect(notesQuery?.getAll("session_ids")).toEqual(["session-123"]);
    expect(notesQuery?.getAll("include_annotation_names")).toEqual(["note"]);

    const output = io.stdout.mock.calls[0]?.[0];
    const parsedOutput = JSON.parse(String(output));
    expect(parsedOutput[0].annotations).toEqual([
      expect.objectContaining({ id: "session-annotation-1", name: "reviewer" }),
    ]);
    expect(parsedOutput[0].notes).toEqual([
      expect.objectContaining({ id: "session-note-1", name: "note" }),
    ]);
  });

  it("chunks session annotation reads for session list", async () => {
    const sessionIds = Array.from(
      { length: 101 },
      (_, index) => `session-${index + 1}`
    );
    useProjectResolution();
    mock.server.use(
      http.get("/v1/projects/{project_identifier}/sessions", ({ response }) =>
        response(200).json({
          data: sessionIds.map((sessionId, index) => ({
            id: `U2Vzc2lvbjox${index}`,
            session_id: sessionId,
            project_id: "project-default",
            start_time: "2026-01-13T10:00:00.000Z",
            end_time: "2026-01-13T10:01:00.000Z",
            traces: [],
          })),
          next_cursor: null,
        })
      )
    );
    const annotationReads = useSessionAnnotationReads();
    captureCliOutput();

    await createSessionCommand().parseAsync(
      [
        "list",
        "--project",
        "default",
        "--limit",
        "101",
        "--include-annotations",
        "--format",
        "raw",
        ...BASE_ARGS,
      ],
      { from: "user" }
    );

    expect(annotationReads.queries).toHaveLength(2);
    expect(annotationReads.queries[0]?.getAll("session_ids")).toHaveLength(100);
    expect(annotationReads.queries[1]?.getAll("session_ids")).toEqual([
      "session-101",
    ]);
  });
});
