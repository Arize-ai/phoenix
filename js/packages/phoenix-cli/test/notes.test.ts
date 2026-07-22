import type { componentsV1 } from "@arizeai/phoenix-testing";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createSpanCommand } from "../src/commands/span";
import { createTraceCommand } from "../src/commands/trace";
import { ExitCode } from "../src/exitCodes";
import { http, setupMockPhoenixServer } from "./mockServer";
import { BASE_ARGS, captureCliOutput, mockProcessExit } from "./testUtils";

const mock = setupMockPhoenixServer();

/**
 * Handler that reports the given Phoenix server version. The capability
 * guards in addSpanNote/addTraceNote resolve the server version by fetching
 * this endpoint, and the endpoint returns the version string as plain text.
 */
function serverVersionHandler(version: string) {
  return http.get("/arize_phoenix_version", ({ response }) =>
    response.untyped(new Response(version, { status: 200 }))
  );
}

const SPAN_FIXTURE: componentsV1["schemas"]["Span"] = {
  name: "root",
  span_kind: "CHAIN",
  parent_id: null,
  status_code: "OK",
  status_message: "",
  start_time: "2026-01-13T10:00:00.000Z",
  end_time: "2026-01-13T10:00:01.000Z",
  attributes: {
    "input.value": "hello",
    "output.value": "world",
  },
  events: [],
  context: {
    trace_id: "trace-123",
    span_id: "span-123",
  },
};

const SPAN_NOTE_FIXTURE: componentsV1["schemas"]["SpanAnnotation"] = {
  id: "span-note-1",
  created_at: "2026-01-13T10:00:00.750Z",
  updated_at: "2026-01-13T10:00:00.750Z",
  source: "API",
  user_id: null,
  name: "note",
  annotator_kind: "HUMAN",
  result: {
    explanation: "span note text",
  },
  metadata: null,
  identifier: "px-span-note:1",
  span_id: "span-123",
};

const SPAN_ANNOTATION_FIXTURE: componentsV1["schemas"]["SpanAnnotation"] = {
  id: "annotation-1",
  created_at: "2026-01-13T10:00:00.250Z",
  updated_at: "2026-01-13T10:00:00.250Z",
  source: "API",
  user_id: null,
  name: "correctness",
  annotator_kind: "HUMAN",
  result: {
    label: "correct",
  },
  metadata: null,
  identifier: "annotation:1",
  span_id: "span-123",
};

const TRACE_NOTE_FIXTURE: componentsV1["schemas"]["TraceAnnotation"] = {
  id: "trace-note-1",
  created_at: "2026-01-13T10:00:00.500Z",
  updated_at: "2026-01-13T10:00:00.500Z",
  source: "API",
  user_id: null,
  name: "note",
  annotator_kind: "HUMAN",
  result: {
    explanation: "trace note text",
  },
  metadata: null,
  identifier: "px-trace-note:1",
  trace_id: "trace-123",
};

/**
 * Pin the project-by-identifier lookup used to resolve `--project default`.
 */
function useProjectHandler() {
  mock.server.use(
    http.get("/v1/projects/{project_identifier}", ({ response }) =>
      response(200).json({
        data: { id: "project-default", name: "default" },
      })
    )
  );
}

/**
 * Pin the project spans page with the default span fixture.
 */
function useSpanPageHandler() {
  mock.server.use(
    http.get("/v1/projects/{project_identifier}/spans", ({ response }) =>
      response(200).json({
        data: [SPAN_FIXTURE],
        next_cursor: null,
      })
    )
  );
}

/**
 * Register a handler for the project span_annotations page that records each
 * request's path param and query string, answering with the annotations the
 * given resolver picks for that query.
 */
function captureSpanAnnotationsRequests(
  resolve: (
    query: URLSearchParams
  ) => componentsV1["schemas"]["SpanAnnotation"][]
) {
  const captured: {
    projectIdentifier?: string;
    queries: URLSearchParams[];
  } = { queries: [] };

  mock.server.use(
    http.get(
      "/v1/projects/{project_identifier}/span_annotations",
      ({ params, request, response }) => {
        captured.projectIdentifier = params.project_identifier;
        const query = new URL(request.url).searchParams;
        captured.queries.push(query);
        return response(200).json({
          data: resolve(query),
          next_cursor: null,
        });
      }
    )
  );

  return captured;
}

/**
 * Register a handler for the project trace_annotations page that records each
 * request's path param and query string, answering with the annotations the
 * given resolver picks for that query.
 */
function captureTraceAnnotationsRequests(
  resolve: (
    query: URLSearchParams
  ) => componentsV1["schemas"]["TraceAnnotation"][]
) {
  const captured: {
    projectIdentifier?: string;
    queries: URLSearchParams[];
  } = { queries: [] };

  mock.server.use(
    http.get(
      "/v1/projects/{project_identifier}/trace_annotations",
      ({ params, request, response }) => {
        captured.projectIdentifier = params.project_identifier;
        const query = new URL(request.url).searchParams;
        captured.queries.push(query);
        return response(200).json({
          data: resolve(query),
          next_cursor: null,
        });
      }
    )
  );

  return captured;
}

/**
 * Register a handler for POST /v1/span_notes that records the request body.
 */
function captureSpanNotePost({ id }: { id: string }) {
  const captured: { body?: unknown } = {};

  mock.server.use(
    http.post("/v1/span_notes", async ({ request, response }) => {
      captured.body = await request.clone().json();
      return response(200).json({ data: { id } });
    })
  );

  return captured;
}

/**
 * Register a handler for POST /v1/trace_notes that records the request body.
 */
function captureTraceNotePost({ id }: { id: string }) {
  const captured: { body?: unknown } = {};

  mock.server.use(
    http.post("/v1/trace_notes", async ({ request, response }) => {
      captured.body = await request.clone().json();
      return response(200).json({ data: { id } });
    })
  );

  return captured;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("span add-note", () => {
  it("posts a span note and returns raw output", async () => {
    const captured = captureSpanNotePost({ id: "span-note-1" });
    const io = captureCliOutput();

    await createSpanCommand().parseAsync(
      [
        "add-note",
        "span-123",
        "--text",
        "  needs review  ",
        "--format",
        "raw",
        ...BASE_ARGS,
      ],
      { from: "user" }
    );

    expect(captured.body).toEqual({
      data: {
        span_id: "span-123",
        note: "needs review",
      },
    });
    expect(io.stdout).toHaveBeenCalledWith(
      JSON.stringify({
        id: "span-note-1",
        targetType: "span",
        targetId: "span-123",
        text: "needs review",
      })
    );
  });

  it("fails with INVALID_ARGUMENT when --text is missing", async () => {
    // No handlers registered: any network call would fail via
    // onUnhandledRequest: "error".
    vi.spyOn(console, "error").mockImplementation(() => {});
    const exitSpy = mockProcessExit();

    await expect(
      createSpanCommand().parseAsync(["add-note", "span-123", ...BASE_ARGS], {
        from: "user",
      })
    ).rejects.toThrow(`process.exit:${ExitCode.INVALID_ARGUMENT}`);

    expect(exitSpy).toHaveBeenCalledWith(ExitCode.INVALID_ARGUMENT);
  });

  it("fails with INVALID_ARGUMENT when --text is blank", async () => {
    // No handlers registered: any network call would fail via
    // onUnhandledRequest: "error".
    const stderrSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const exitSpy = mockProcessExit();

    await expect(
      createSpanCommand().parseAsync(
        ["add-note", "span-123", "--text", "   ", ...BASE_ARGS],
        { from: "user" }
      )
    ).rejects.toThrow(`process.exit:${ExitCode.INVALID_ARGUMENT}`);

    expect(exitSpy).toHaveBeenCalledWith(ExitCode.INVALID_ARGUMENT);
    expect(stderrSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        "Invalid value for --text: <empty>. Expected non-empty text."
      )
    );
  });
});

describe("trace add-note", () => {
  it("posts a trace note and returns json output", async () => {
    mock.server.use(serverVersionHandler("14.13.0"));
    const captured = captureTraceNotePost({ id: "trace-note-1" });
    const io = captureCliOutput();

    await createTraceCommand().parseAsync(
      [
        "add-note",
        "trace-123",
        "--text",
        "  needs review  ",
        "--format",
        "json",
        ...BASE_ARGS,
      ],
      { from: "user" }
    );

    expect(captured.body).toEqual({
      data: {
        trace_id: "trace-123",
        note: "needs review",
      },
    });
    expect(io.stdout).toHaveBeenCalledWith(
      JSON.stringify(
        {
          id: "trace-note-1",
          targetType: "trace",
          targetId: "trace-123",
          text: "needs review",
        },
        null,
        2
      )
    );
  });

  it("fails with INVALID_ARGUMENT when --text is missing", async () => {
    // No handlers registered: any network call would fail via
    // onUnhandledRequest: "error".
    vi.spyOn(console, "error").mockImplementation(() => {});
    const exitSpy = mockProcessExit();

    await expect(
      createTraceCommand().parseAsync(["add-note", "trace-123", ...BASE_ARGS], {
        from: "user",
      })
    ).rejects.toThrow(`process.exit:${ExitCode.INVALID_ARGUMENT}`);

    expect(exitSpy).toHaveBeenCalledWith(ExitCode.INVALID_ARGUMENT);
  });

  it("fails with INVALID_ARGUMENT when --text is blank", async () => {
    // No handlers registered: any network call would fail via
    // onUnhandledRequest: "error".
    const stderrSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const exitSpy = mockProcessExit();

    await expect(
      createTraceCommand().parseAsync(
        ["add-note", "trace-123", "--text", "   ", ...BASE_ARGS],
        { from: "user" }
      )
    ).rejects.toThrow(`process.exit:${ExitCode.INVALID_ARGUMENT}`);

    expect(exitSpy).toHaveBeenCalledWith(ExitCode.INVALID_ARGUMENT);
    expect(stderrSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        "Invalid value for --text: <empty>. Expected non-empty text."
      )
    );
  });
});

describe("add-note --identifier round-trip", () => {
  it("threads --identifier into the span_notes request body", async () => {
    // identifier-body capability check (>= 15.5.0)
    mock.server.use(serverVersionHandler("15.5.0"));
    const captured = captureSpanNotePost({ id: "span-note-id" });
    captureCliOutput();

    await createSpanCommand().parseAsync(
      [
        "add-note",
        "span-123",
        "--text",
        "needs review",
        "--identifier",
        "px-coding-session:abc12345",
        "--format",
        "raw",
        ...BASE_ARGS,
      ],
      { from: "user" }
    );

    expect(captured.body).toEqual({
      data: {
        span_id: "span-123",
        note: "needs review",
        identifier: "px-coding-session:abc12345",
      },
    });
  });

  it("threads --identifier into the trace_notes request body", async () => {
    // capability check (route + identifier-body both gated on this version)
    mock.server.use(serverVersionHandler("15.5.0"));
    const captured = captureTraceNotePost({ id: "trace-note-id" });
    captureCliOutput();

    await createTraceCommand().parseAsync(
      [
        "add-note",
        "trace-123",
        "--text",
        "needs review",
        "--identifier",
        "px-coding-session:abc12345",
        "--format",
        "raw",
        ...BASE_ARGS,
      ],
      { from: "user" }
    );

    expect(captured.body).toEqual({
      data: {
        trace_id: "trace-123",
        note: "needs review",
        identifier: "px-coding-session:abc12345",
      },
    });
  });
});

describe("span note readback", () => {
  it("includes notes in span list raw output when requested", async () => {
    useProjectHandler();
    useSpanPageHandler();
    const captured = captureSpanAnnotationsRequests(() => [SPAN_NOTE_FIXTURE]);
    const io = captureCliOutput();

    await createSpanCommand().parseAsync(
      [
        "list",
        "--project",
        "default",
        "--include-notes",
        "--format",
        "raw",
        ...BASE_ARGS,
      ],
      { from: "user" }
    );

    expect(captured.projectIdentifier).toBe("project-default");
    expect(captured.queries[0]?.getAll("include_annotation_names")).toContain(
      "note"
    );

    const output = io.stdout.mock.calls[0]?.[0];
    const parsedOutput = JSON.parse(String(output));
    expect(parsedOutput[0].notes).toEqual([
      expect.objectContaining({ id: "span-note-1", name: "note" }),
    ]);
  });

  it("keeps note names out of annotations when both note flags are used", async () => {
    useProjectHandler();
    useSpanPageHandler();
    const captured = captureSpanAnnotationsRequests((query) =>
      query.getAll("include_annotation_names").includes("note")
        ? [SPAN_NOTE_FIXTURE]
        : [SPAN_ANNOTATION_FIXTURE]
    );
    const io = captureCliOutput();

    await createSpanCommand().parseAsync(
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

    const annotationsQuery = captured.queries.find((query) =>
      query.getAll("exclude_annotation_names").includes("note")
    );
    const notesQuery = captured.queries.find((query) =>
      query.getAll("include_annotation_names").includes("note")
    );
    expect(annotationsQuery).toBeDefined();
    expect(notesQuery).toBeDefined();

    const output = io.stdout.mock.calls[0]?.[0];
    const parsedOutput = JSON.parse(String(output));
    expect(parsedOutput[0].annotations).toEqual([
      expect.objectContaining({ id: "annotation-1", name: "correctness" }),
    ]);
    expect(parsedOutput[0].annotations).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ name: "note" })])
    );
    expect(parsedOutput[0].notes).toEqual([
      expect.objectContaining({ id: "span-note-1", name: "note" }),
    ]);
  });
});

describe("trace note readback", () => {
  it("includes trace and span notes in trace get raw output when requested", async () => {
    useProjectHandler();
    useSpanPageHandler();
    const capturedTrace = captureTraceAnnotationsRequests(() => [
      TRACE_NOTE_FIXTURE,
    ]);
    const capturedSpan = captureSpanAnnotationsRequests(() => [
      SPAN_NOTE_FIXTURE,
    ]);
    const io = captureCliOutput();

    await createTraceCommand().parseAsync(
      [
        "get",
        "trace-123",
        "--project",
        "default",
        "--include-notes",
        "--format",
        "raw",
        ...BASE_ARGS,
      ],
      { from: "user" }
    );

    expect(capturedTrace.projectIdentifier).toBe("project-default");
    expect(
      capturedTrace.queries[0]?.getAll("include_annotation_names")
    ).toContain("note");
    expect(capturedSpan.projectIdentifier).toBe("project-default");
    expect(
      capturedSpan.queries[0]?.getAll("include_annotation_names")
    ).toContain("note");

    const output = io.stdout.mock.calls[0]?.[0];
    const parsedOutput = JSON.parse(String(output));
    expect(parsedOutput.notes).toEqual([
      expect.objectContaining({ id: "trace-note-1", name: "note" }),
    ]);
    expect(parsedOutput.spans[0].notes).toEqual([
      expect.objectContaining({ id: "span-note-1", name: "note" }),
    ]);
  });

  it("keeps notes excluded when only --include-annotations is used", async () => {
    useProjectHandler();
    useSpanPageHandler();
    const capturedTrace = captureTraceAnnotationsRequests(() => []);
    const capturedSpan = captureSpanAnnotationsRequests(() => []);
    const io = captureCliOutput();

    await createTraceCommand().parseAsync(
      [
        "get",
        "trace-123",
        "--project",
        "default",
        "--include-annotations",
        "--format",
        "raw",
        ...BASE_ARGS,
      ],
      { from: "user" }
    );

    expect(
      capturedTrace.queries[0]?.getAll("exclude_annotation_names")
    ).toContain("note");
    expect(
      capturedSpan.queries[0]?.getAll("exclude_annotation_names")
    ).toContain("note");

    const output = io.stdout.mock.calls[0]?.[0];
    const parsedOutput = JSON.parse(String(output));
    expect(parsedOutput.notes).toBeUndefined();
    expect(parsedOutput.spans[0].notes).toBeUndefined();
  });

  it("includes trace and span notes in trace list raw output when requested", async () => {
    useProjectHandler();
    useSpanPageHandler();
    const capturedTrace = captureTraceAnnotationsRequests(() => [
      TRACE_NOTE_FIXTURE,
    ]);
    const capturedSpan = captureSpanAnnotationsRequests(() => [
      SPAN_NOTE_FIXTURE,
    ]);
    const io = captureCliOutput();

    await createTraceCommand().parseAsync(
      [
        "list",
        "--project",
        "default",
        "--include-notes",
        "--format",
        "raw",
        ...BASE_ARGS,
      ],
      { from: "user" }
    );

    expect(capturedTrace.projectIdentifier).toBe("project-default");
    expect(
      capturedTrace.queries[0]?.getAll("include_annotation_names")
    ).toContain("note");
    expect(capturedSpan.projectIdentifier).toBe("project-default");
    expect(
      capturedSpan.queries[0]?.getAll("include_annotation_names")
    ).toContain("note");

    const output = io.stdout.mock.calls[0]?.[0];
    const parsedOutput = JSON.parse(String(output));
    expect(parsedOutput[0].notes).toEqual([
      expect.objectContaining({ id: "trace-note-1", name: "note" }),
    ]);
    expect(parsedOutput[0].spans[0].notes).toEqual([
      expect.objectContaining({ id: "span-note-1", name: "note" }),
    ]);
  });
});
