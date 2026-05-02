import { afterEach, describe, expect, it, vi } from "vitest";

import { createSessionCommand } from "../src/commands/session";
import { ExitCode } from "../src/exitCodes";

function makeFetchMock(
  responses: Array<
    | {
        ok: boolean;
        status?: number;
        body?: unknown;
        text?: string;
        headers?: Record<string, string>;
      }
    | { error: Error }
  >
) {
  let callIndex = 0;
  return vi.fn().mockImplementation((requestOrUrl: Request | string) => {
    const response = responses[callIndex++] ?? responses[responses.length - 1];
    if ("error" in response) {
      return Promise.reject(response.error);
    }
    const status = response.status ?? (response.ok ? 200 : 500);
    const url =
      requestOrUrl instanceof Request ? requestOrUrl.url : requestOrUrl;
    return Promise.resolve({
      ok: response.ok,
      status,
      statusText: response.ok ? "OK" : "Error",
      url,
      headers: new Headers(response.headers),
      json: () => Promise.resolve(response.body ?? {}),
      text: () => Promise.resolve(response.text ?? ""),
    });
  });
}

function getFetchUrl(arg: unknown): string {
  if (arg instanceof Request) return arg.url;
  return String(arg);
}

function getFetchMethod(arg: unknown, init?: RequestInit): string {
  if (arg instanceof Request) return arg.method;
  return init?.method ?? "GET";
}

async function getFetchBody(
  arg: unknown,
  init?: RequestInit
): Promise<unknown> {
  if (arg instanceof Request) {
    const text = await arg.clone().text();
    return text ? JSON.parse(text) : undefined;
  }
  if (typeof init?.body === "string") {
    return JSON.parse(init.body);
  }
  return undefined;
}

function makeProjectResponse() {
  return {
    ok: true,
    body: {
      data: {
        id: "project-default",
      },
    },
  } as const;
}

function makeSessionResponse() {
  return {
    ok: true,
    body: {
      data: {
        id: "U2Vzc2lvbjox",
        session_id: "session-123",
        project_id: "project-default",
        start_time: "2026-01-13T10:00:00.000Z",
        end_time: "2026-01-13T10:01:00.000Z",
        traces: [],
      },
    },
  } as const;
}

function makeSessionPageResponse() {
  return {
    ok: true,
    body: {
      data: [
        {
          id: "U2Vzc2lvbjox",
          session_id: "session-123",
          project_id: "project-default",
          start_time: "2026-01-13T10:00:00.000Z",
          end_time: "2026-01-13T10:01:00.000Z",
          traces: [],
        },
      ],
      next_cursor: null,
    },
  } as const;
}

function makeSessionAnnotationResponse() {
  return {
    ok: true,
    body: {
      data: [
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
        },
      ],
      next_cursor: null,
    },
  } as const;
}

function makeSessionNoteResponse() {
  return {
    ok: true,
    body: {
      data: [
        {
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
        },
      ],
      next_cursor: null,
    },
  } as const;
}

const BASE_ARGS = ["--endpoint", "http://localhost:6006", "--no-progress"];
const SERVER_VERSION_RESPONSE = {
  ok: true,
  text: "14.17.0",
} as const;

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("session annotate", () => {
  it("resolves a session and posts a sync session annotation", async () => {
    const fetchMock = makeFetchMock([
      makeSessionResponse(),
      SERVER_VERSION_RESPONSE,
      {
        ok: true,
        body: { data: [{ id: "session-annotation-1" }] },
      },
    ]);
    vi.stubGlobal("fetch", fetchMock);
    const stdoutSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});

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

    expect(getFetchUrl(fetchMock.mock.calls[0][0])).toContain(
      "/v1/sessions/U2Vzc2lvbjox"
    );
    expect(getFetchUrl(fetchMock.mock.calls[2][0])).toContain(
      "/v1/session_annotations"
    );
    expect(getFetchUrl(fetchMock.mock.calls[2][0])).toContain("sync=true");
    expect(
      getFetchMethod(fetchMock.mock.calls[2][0], fetchMock.mock.calls[2][1])
    ).toBe("POST");
    await expect(
      getFetchBody(fetchMock.mock.calls[2][0], fetchMock.mock.calls[2][1])
    ).resolves.toEqual({
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
    expect(stdoutSpy).toHaveBeenCalledWith(
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
    const fetchMock = makeFetchMock([{ ok: true, body: {} }]);
    vi.stubGlobal("fetch", fetchMock);
    const stderrSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(((
      code?: number
    ) => {
      throw new Error(`process.exit:${code}`);
    }) as never);

    await expect(
      createSessionCommand().parseAsync(
        ["annotate", "session-123", "--label", "pass", ...BASE_ARGS],
        { from: "user" }
      )
    ).rejects.toThrow(`process.exit:${ExitCode.INVALID_ARGUMENT}`);

    expect(exitSpy).toHaveBeenCalledWith(ExitCode.INVALID_ARGUMENT);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(stderrSpy).toHaveBeenCalledWith(
      expect.stringContaining("Missing required flag --name.")
    );
  });

  it("validates invalid scores before network calls", async () => {
    const fetchMock = makeFetchMock([{ ok: true, body: {} }]);
    vi.stubGlobal("fetch", fetchMock);
    const stderrSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(((
      code?: number
    ) => {
      throw new Error(`process.exit:${code}`);
    }) as never);

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
    expect(fetchMock).not.toHaveBeenCalled();
    expect(stderrSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        "Invalid value for --score: nope. Expected a finite number."
      )
    );
  });

  it("validates empty annotation results before network calls", async () => {
    const fetchMock = makeFetchMock([{ ok: true, body: {} }]);
    vi.stubGlobal("fetch", fetchMock);
    const stderrSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(((
      code?: number
    ) => {
      throw new Error(`process.exit:${code}`);
    }) as never);

    await expect(
      createSessionCommand().parseAsync(
        ["annotate", "session-123", "--name", "reviewer", ...BASE_ARGS],
        { from: "user" }
      )
    ).rejects.toThrow(`process.exit:${ExitCode.INVALID_ARGUMENT}`);

    expect(exitSpy).toHaveBeenCalledWith(ExitCode.INVALID_ARGUMENT);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(stderrSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        "At least one of --label, --score, or --explanation must be provided."
      )
    );
  });

  it("validates invalid annotator kinds before network calls", async () => {
    const fetchMock = makeFetchMock([{ ok: true, body: {} }]);
    vi.stubGlobal("fetch", fetchMock);
    const stderrSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(((
      code?: number
    ) => {
      throw new Error(`process.exit:${code}`);
    }) as never);

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
    expect(fetchMock).not.toHaveBeenCalled();
    expect(stderrSpy).toHaveBeenCalledWith(
      expect.stringContaining("Invalid value for --annotator-kind: bot")
    );
  });

  it("reports API errors from session annotation", async () => {
    const fetchMock = makeFetchMock([
      makeSessionResponse(),
      SERVER_VERSION_RESPONSE,
      {
        ok: false,
        status: 400,
        body: { detail: "The name 'note' is reserved for session notes." },
      },
    ]);
    vi.stubGlobal("fetch", fetchMock);
    const stderrSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(((
      code?: number
    ) => {
      throw new Error(`process.exit:${code}`);
    }) as never);

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
    const fetchMock = makeFetchMock([
      makeSessionResponse(),
      SERVER_VERSION_RESPONSE,
      {
        ok: true,
        body: { data: { id: "session-note-1" } },
      },
    ]);
    vi.stubGlobal("fetch", fetchMock);
    const stdoutSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});

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

    expect(getFetchUrl(fetchMock.mock.calls[0][0])).toContain(
      "/v1/sessions/U2Vzc2lvbjox"
    );
    expect(getFetchUrl(fetchMock.mock.calls[1][0])).toContain(
      "/arize_phoenix_version"
    );
    expect(getFetchUrl(fetchMock.mock.calls[2][0])).toContain(
      "/v1/session_notes"
    );
    await expect(
      getFetchBody(fetchMock.mock.calls[2][0], fetchMock.mock.calls[2][1])
    ).resolves.toEqual({
      data: {
        session_id: "session-123",
        note: "needs review",
      },
    });
    expect(stdoutSpy).toHaveBeenCalledWith(
      JSON.stringify({
        id: "session-note-1",
        targetType: "session",
        targetId: "session-123",
        text: "needs review",
      })
    );
  });

  it("validates blank note text before network calls", async () => {
    const fetchMock = makeFetchMock([{ ok: true, body: {} }]);
    vi.stubGlobal("fetch", fetchMock);
    const stderrSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(((
      code?: number
    ) => {
      throw new Error(`process.exit:${code}`);
    }) as never);

    await expect(
      createSessionCommand().parseAsync(
        ["add-note", "session-123", "--text", "   ", ...BASE_ARGS],
        { from: "user" }
      )
    ).rejects.toThrow(`process.exit:${ExitCode.INVALID_ARGUMENT}`);

    expect(exitSpy).toHaveBeenCalledWith(ExitCode.INVALID_ARGUMENT);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(stderrSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        "Invalid value for --text: <empty>. Expected non-empty text."
      )
    );
  });

  it("fails fast on older Phoenix servers", async () => {
    const fetchMock = makeFetchMock([
      makeSessionResponse(),
      {
        ok: true,
        text: "14.16.0",
      },
    ]);
    vi.stubGlobal("fetch", fetchMock);
    const stderrSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(((
      code?: number
    ) => {
      throw new Error(`process.exit:${code}`);
    }) as never);

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
    expect(stderrSpy).toHaveBeenCalledWith(
      expect.stringContaining("requires Phoenix server >= 14.17.0")
    );
  });
});

describe("session annotation and note readback", () => {
  it("includes notes in session get raw output when requested", async () => {
    const fetchMock = makeFetchMock([
      makeSessionResponse(),
      makeSessionNoteResponse(),
    ]);
    vi.stubGlobal("fetch", fetchMock);
    const stdoutSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});

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

    expect(getFetchUrl(fetchMock.mock.calls[1][0])).toContain(
      "/v1/projects/project-default/session_annotations"
    );
    expect(getFetchUrl(fetchMock.mock.calls[1][0])).toContain(
      "include_annotation_names=note"
    );

    const output = stdoutSpy.mock.calls[0]?.[0];
    const parsedOutput = JSON.parse(String(output));
    expect(parsedOutput.session.notes).toEqual([
      expect.objectContaining({ id: "session-note-1", name: "note" }),
    ]);
    expect(parsedOutput.notes).toBeUndefined();
  });

  it("excludes notes from session get annotations", async () => {
    const fetchMock = makeFetchMock([
      makeSessionResponse(),
      makeSessionAnnotationResponse(),
    ]);
    vi.stubGlobal("fetch", fetchMock);
    const stdoutSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});

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

    expect(getFetchUrl(fetchMock.mock.calls[1][0])).toContain(
      "exclude_annotation_names=note"
    );

    const output = stdoutSpy.mock.calls[0]?.[0];
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
    const fetchMock = makeFetchMock([
      makeProjectResponse(),
      makeSessionPageResponse(),
      { ok: true, body: { data: [], next_cursor: null } },
      { ok: true, body: { data: [], next_cursor: null } },
    ]);
    vi.stubGlobal("fetch", fetchMock);
    const stdoutSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});

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

    const output = String(stdoutSpy.mock.calls[0]?.[0]);
    expect(output).toContain("annotations");
    expect(output).toContain("notes");
  });

  it("includes annotations and notes in session list raw output", async () => {
    const fetchMock = makeFetchMock([
      makeProjectResponse(),
      makeSessionPageResponse(),
      makeSessionAnnotationResponse(),
      makeSessionNoteResponse(),
    ]);
    vi.stubGlobal("fetch", fetchMock);
    const stdoutSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});

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

    const annotationsUrl = new URL(getFetchUrl(fetchMock.mock.calls[2][0]));
    const notesUrl = new URL(getFetchUrl(fetchMock.mock.calls[3][0]));
    expect(annotationsUrl.searchParams.getAll("session_ids")).toEqual([
      "session-123",
    ]);
    expect(
      annotationsUrl.searchParams.getAll("exclude_annotation_names")
    ).toEqual(["note"]);
    expect(notesUrl.searchParams.getAll("session_ids")).toEqual([
      "session-123",
    ]);
    expect(notesUrl.searchParams.getAll("include_annotation_names")).toEqual([
      "note",
    ]);

    const output = stdoutSpy.mock.calls[0]?.[0];
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
    const fetchMock = makeFetchMock([
      makeProjectResponse(),
      {
        ok: true,
        body: {
          data: sessionIds.map((sessionId, index) => ({
            id: `U2Vzc2lvbjox${index}`,
            session_id: sessionId,
            project_id: "project-default",
            start_time: "2026-01-13T10:00:00.000Z",
            end_time: "2026-01-13T10:01:00.000Z",
            traces: [],
          })),
          next_cursor: null,
        },
      },
      { ok: true, body: { data: [], next_cursor: null } },
      { ok: true, body: { data: [], next_cursor: null } },
    ]);
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});

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

    const firstAnnotationsUrl = new URL(
      getFetchUrl(fetchMock.mock.calls[2][0])
    );
    const secondAnnotationsUrl = new URL(
      getFetchUrl(fetchMock.mock.calls[3][0])
    );
    expect(firstAnnotationsUrl.searchParams.getAll("session_ids")).toHaveLength(
      100
    );
    expect(secondAnnotationsUrl.searchParams.getAll("session_ids")).toEqual([
      "session-101",
    ]);
  });
});
