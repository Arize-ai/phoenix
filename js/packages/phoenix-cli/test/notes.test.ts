import { afterEach, describe, expect, it, vi } from "vitest";

import { createSpanCommand } from "../src/commands/span";
import { createTraceCommand } from "../src/commands/trace";
import { ExitCode } from "../src/exitCodes";

function makeFetchMock(
  responses: Array<
    { ok: boolean; status?: number; body?: unknown } | { error: Error }
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
      headers: new Headers(),
      json: () => Promise.resolve(response.body ?? {}),
      text: () => Promise.resolve(""),
    });
  });
}

function getFetchUrl(arg: unknown): string {
  if (arg instanceof Request) return arg.url;
  return String(arg);
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

const BASE_ARGS = ["--endpoint", "http://localhost:6006", "--no-progress"];

describe("span add-note", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("posts a span note and returns raw output", async () => {
    const fetchMock = makeFetchMock([
      {
        ok: true,
        body: { data: { id: "span-note-1" } },
      },
    ]);
    vi.stubGlobal("fetch", fetchMock);
    const stdoutSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});

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

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(getFetchUrl(fetchMock.mock.calls[0][0])).toContain("/v1/span_notes");
    await expect(
      getFetchBody(fetchMock.mock.calls[0][0], fetchMock.mock.calls[0][1])
    ).resolves.toEqual({
      data: {
        span_id: "span-123",
        note: "needs review",
      },
    });
    expect(stdoutSpy).toHaveBeenCalledWith(
      JSON.stringify({
        id: "span-note-1",
        targetType: "span",
        targetId: "span-123",
        text: "needs review",
        annotatorKind: "HUMAN",
      })
    );
  });

  it("fails with INVALID_ARGUMENT when --text is missing", async () => {
    const fetchMock = makeFetchMock([{ ok: true, body: {} }]);
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "error").mockImplementation(() => {});
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(((
      code?: number
    ) => {
      throw new Error(`process.exit:${code}`);
    }) as never);

    await expect(
      createSpanCommand().parseAsync(["add-note", "span-123", ...BASE_ARGS], {
        from: "user",
      })
    ).rejects.toThrow(`process.exit:${ExitCode.INVALID_ARGUMENT}`);

    expect(exitSpy).toHaveBeenCalledWith(ExitCode.INVALID_ARGUMENT);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fails with INVALID_ARGUMENT when --text is blank", async () => {
    const fetchMock = makeFetchMock([{ ok: true, body: {} }]);
    vi.stubGlobal("fetch", fetchMock);
    const stderrSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(((
      code?: number
    ) => {
      throw new Error(`process.exit:${code}`);
    }) as never);

    await expect(
      createSpanCommand().parseAsync(
        ["add-note", "span-123", "--text", "   ", ...BASE_ARGS],
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
});

describe("trace add-note", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("posts a trace note and returns json output", async () => {
    const fetchMock = makeFetchMock([
      {
        ok: true,
        body: { data: { id: "trace-note-1" } },
      },
    ]);
    vi.stubGlobal("fetch", fetchMock);
    const stdoutSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});

    await createTraceCommand().parseAsync(
      [
        "add-note",
        "trace-123",
        "--text",
        "needs review",
        "--format",
        "json",
        ...BASE_ARGS,
      ],
      { from: "user" }
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(getFetchUrl(fetchMock.mock.calls[0][0])).toContain(
      "/v1/trace_notes"
    );
    await expect(
      getFetchBody(fetchMock.mock.calls[0][0], fetchMock.mock.calls[0][1])
    ).resolves.toEqual({
      data: {
        trace_id: "trace-123",
        note: "needs review",
      },
    });
    expect(stdoutSpy).toHaveBeenCalledWith(
      JSON.stringify(
        {
          id: "trace-note-1",
          targetType: "trace",
          targetId: "trace-123",
          text: "needs review",
          annotatorKind: "HUMAN",
        },
        null,
        2
      )
    );
  });
});

describe("trace note readback", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("includes trace and span notes in trace get raw output when requested", async () => {
    const fetchMock = makeFetchMock([
      {
        ok: true,
        body: {
          data: {
            id: "project-default",
          },
        },
      },
      {
        ok: true,
        body: {
          data: [
            {
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
            },
          ],
          next_cursor: null,
        },
      },
      {
        ok: true,
        body: {
          data: [
            {
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
            },
          ],
          next_cursor: null,
        },
      },
      {
        ok: true,
        body: {
          data: [
            {
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
            },
          ],
          next_cursor: null,
        },
      },
    ]);
    vi.stubGlobal("fetch", fetchMock);
    const stdoutSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});

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

    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(getFetchUrl(fetchMock.mock.calls[2][0])).toContain(
      "/v1/projects/project-default/trace_annotations"
    );
    expect(getFetchUrl(fetchMock.mock.calls[2][0])).toContain(
      "include_annotation_names=note"
    );
    expect(getFetchUrl(fetchMock.mock.calls[3][0])).toContain(
      "/v1/projects/project-default/span_annotations"
    );
    expect(getFetchUrl(fetchMock.mock.calls[3][0])).toContain(
      "include_annotation_names=note"
    );

    const output = stdoutSpy.mock.calls[0]?.[0];
    const parsedOutput = JSON.parse(String(output));
    expect(parsedOutput.notes).toEqual([
      expect.objectContaining({
        id: "trace-note-1",
        name: "note",
        trace_id: "trace-123",
      }),
    ]);
    expect(parsedOutput.spans[0].notes).toEqual([
      expect.objectContaining({
        id: "span-note-1",
        name: "note",
        span_id: "span-123",
      }),
    ]);
  });

  it("keeps notes excluded when only --include-annotations is used", async () => {
    const fetchMock = makeFetchMock([
      {
        ok: true,
        body: {
          data: {
            id: "project-default",
          },
        },
      },
      {
        ok: true,
        body: {
          data: [
            {
              name: "root",
              span_kind: "CHAIN",
              parent_id: null,
              status_code: "OK",
              status_message: "",
              start_time: "2026-01-13T10:00:00.000Z",
              end_time: "2026-01-13T10:00:01.000Z",
              attributes: {},
              events: [],
              context: {
                trace_id: "trace-123",
                span_id: "span-123",
              },
            },
          ],
          next_cursor: null,
        },
      },
      {
        ok: true,
        body: {
          data: [],
          next_cursor: null,
        },
      },
      {
        ok: true,
        body: {
          data: [],
          next_cursor: null,
        },
      },
    ]);
    vi.stubGlobal("fetch", fetchMock);
    const stdoutSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});

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

    expect(getFetchUrl(fetchMock.mock.calls[2][0])).not.toContain(
      "include_annotation_names=note"
    );
    const output = stdoutSpy.mock.calls[0]?.[0];
    const parsedOutput = JSON.parse(String(output));
    expect(parsedOutput.notes).toBeUndefined();
    expect(parsedOutput.spans[0].notes).toBeUndefined();
  });

  it("includes notes in trace list raw output when requested", async () => {
    const fetchMock = makeFetchMock([
      {
        ok: true,
        body: {
          data: {
            id: "project-default",
          },
        },
      },
      {
        ok: true,
        body: {
          data: [
            {
              name: "root",
              span_kind: "CHAIN",
              parent_id: null,
              status_code: "OK",
              status_message: "",
              start_time: "2026-01-13T10:00:00.000Z",
              end_time: "2026-01-13T10:00:01.000Z",
              attributes: {},
              events: [],
              context: {
                trace_id: "trace-123",
                span_id: "span-123",
              },
            },
          ],
          next_cursor: null,
        },
      },
      {
        ok: true,
        body: {
          data: [
            {
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
            },
          ],
          next_cursor: null,
        },
      },
      {
        ok: true,
        body: {
          data: [
            {
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
            },
          ],
          next_cursor: null,
        },
      },
    ]);
    vi.stubGlobal("fetch", fetchMock);
    const stdoutSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});

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

    const output = stdoutSpy.mock.calls[0]?.[0];
    const parsedOutput = JSON.parse(String(output));
    expect(parsedOutput[0].notes).toEqual([
      expect.objectContaining({ id: "trace-note-1" }),
    ]);
    expect(parsedOutput[0].spans[0].notes).toEqual([
      expect.objectContaining({ id: "span-note-1" }),
    ]);
  });
});

describe("span note readback", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("includes notes in span list raw output when requested", async () => {
    const fetchMock = makeFetchMock([
      {
        ok: true,
        body: {
          data: {
            id: "project-default",
          },
        },
      },
      {
        ok: true,
        body: {
          data: [
            {
              name: "root",
              span_kind: "CHAIN",
              parent_id: null,
              status_code: "OK",
              status_message: "",
              start_time: "2026-01-13T10:00:00.000Z",
              end_time: "2026-01-13T10:00:01.000Z",
              attributes: {},
              events: [],
              context: {
                trace_id: "trace-123",
                span_id: "span-123",
              },
            },
          ],
          next_cursor: null,
        },
      },
      {
        ok: true,
        body: {
          data: [
            {
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
            },
          ],
          next_cursor: null,
        },
      },
    ]);
    vi.stubGlobal("fetch", fetchMock);
    const stdoutSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});

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

    expect(getFetchUrl(fetchMock.mock.calls[2][0])).toContain(
      "include_annotation_names=note"
    );
    const output = stdoutSpy.mock.calls[0]?.[0];
    const parsedOutput = JSON.parse(String(output));
    expect(parsedOutput[0].notes).toEqual([
      expect.objectContaining({ id: "span-note-1", name: "note" }),
    ]);
  });
});
