import { afterEach, describe, expect, it, vi } from "vitest";

import { formatAnnotationListOutput } from "../src/commands/formatAnnotationList";
import { createSessionCommand } from "../src/commands/session";
import { createSpanCommand } from "../src/commands/span";
import { createTraceCommand } from "../src/commands/trace";
import { ExitCode } from "../src/exitCodes";

function makeFetchMock(
  responses: Array<
    | { ok: boolean; status?: number; body?: unknown; text?: string }
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
    const body = response.body ?? {};
    const text = response.text ?? JSON.stringify(body);
    return Promise.resolve({
      ok: response.ok,
      status,
      statusText: response.ok ? "OK" : "Error",
      url,
      headers: new Headers(),
      json: () => Promise.resolve(body),
      text: () => Promise.resolve(text),
    });
  });
}

function getFetchUrl(arg: unknown): string {
  if (arg instanceof Request) return arg.url;
  return String(arg);
}

const BASE_ARGS = [
  "--endpoint",
  "http://localhost:6006",
  "--project",
  "default",
  "--no-progress",
];

const PROJECT_RESPONSE = {
  ok: true as const,
  body: { data: { id: "project-default" } },
};

const TRACE_ANNOTATION_ROW = {
  id: "annotation-trace-1",
  name: "axial_coding_category",
  annotator_kind: "HUMAN",
  result: { label: "answered_off_topic", score: null, explanation: null },
  identifier: "coding-session:demo",
  trace_id: "trace-aaa",
} as const;

const SPAN_ANNOTATION_ROW = {
  id: "annotation-span-1",
  name: "axial_coding_category",
  annotator_kind: "HUMAN",
  result: { label: "retrieval_off_topic", score: null, explanation: null },
  identifier: "coding-session:demo",
  span_id: "span-aaa",
} as const;

const SESSION_ANNOTATION_ROW = {
  id: "annotation-session-1",
  name: "axial_coding_category",
  annotator_kind: "HUMAN",
  result: { label: "cross_turn_drift", score: null, explanation: null },
  identifier: "coding-session:demo",
  session_id: "session-aaa",
} as const;

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("formatAnnotationListOutput", () => {
  const annotations = [TRACE_ANNOTATION_ROW];

  it("emits the bare array in raw mode", () => {
    const output = formatAnnotationListOutput({
      annotations,
      target: "trace",
      format: "raw",
    });
    expect(JSON.parse(output)).toEqual(annotations);
  });

  it("envelopes the array under `annotations` in json mode (D6)", () => {
    const output = formatAnnotationListOutput({
      annotations,
      target: "trace",
      format: "json",
    });
    expect(JSON.parse(output)).toEqual({ annotations });
  });

  it("emits a friendly placeholder when the array is empty (pretty)", () => {
    const output = formatAnnotationListOutput({
      annotations: [],
      target: "trace",
      format: "pretty",
    });
    expect(output).toContain("No trace annotations found.");
  });

  it("renders a target_id column matching the listing target", () => {
    const traceOutput = formatAnnotationListOutput({
      annotations: [TRACE_ANNOTATION_ROW],
      target: "trace",
    });
    const spanOutput = formatAnnotationListOutput({
      annotations: [SPAN_ANNOTATION_ROW],
      target: "span",
    });
    const sessionOutput = formatAnnotationListOutput({
      annotations: [SESSION_ANNOTATION_ROW],
      target: "session",
    });
    expect(traceOutput).toContain("trace_id");
    expect(traceOutput).toContain("trace-aaa");
    expect(spanOutput).toContain("span_id");
    expect(spanOutput).toContain("span-aaa");
    expect(sessionOutput).toContain("session_id");
    expect(sessionOutput).toContain("session-aaa");
  });

  it("tolerates absent result objects (gotcha tolerance)", () => {
    const looseAnnotation = {
      id: "annotation-x",
      name: "axial_coding_category",
      identifier: "coding-session:demo",
      trace_id: "trace-x",
    };
    const output = formatAnnotationListOutput({
      annotations: [looseAnnotation],
      target: "trace",
    });
    expect(output).toContain("annotation-x");
  });
});

describe("trace list-annotations", () => {
  it("filters by --identifier and emits the bare array in raw mode", async () => {
    const fetchMock = makeFetchMock([
      PROJECT_RESPONSE,
      {
        ok: true,
        body: { data: [TRACE_ANNOTATION_ROW], next_cursor: null },
      },
    ]);
    vi.stubGlobal("fetch", fetchMock);
    const stdoutSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});

    await createTraceCommand().parseAsync(
      [
        "list-annotations",
        "--identifier",
        "coding-session:demo",
        "--format",
        "raw",
        ...BASE_ARGS,
      ],
      { from: "user" }
    );

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const url = new URL(getFetchUrl(fetchMock.mock.calls[1][0]));
    expect(url.pathname).toBe("/v1/projects/project-default/trace_annotations");
    expect(url.searchParams.getAll("identifier")).toEqual([
      "coding-session:demo",
    ]);
    expect(url.searchParams.getAll("trace_ids")).toEqual([]);
    const output = stdoutSpy.mock.calls[0]?.[0];
    expect(JSON.parse(String(output))).toEqual([TRACE_ANNOTATION_ROW]);
  });

  it("threads --include-name through to include_annotation_names (whitelist semantic)", async () => {
    const fetchMock = makeFetchMock([
      PROJECT_RESPONSE,
      { ok: true, body: { data: [], next_cursor: null } },
    ]);
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});

    await createTraceCommand().parseAsync(
      [
        "list-annotations",
        "--identifier",
        "coding-session:demo",
        "--include-name",
        "note",
        "--format",
        "raw",
        ...BASE_ARGS,
      ],
      { from: "user" }
    );

    const url = new URL(getFetchUrl(fetchMock.mock.calls[1][0]));
    expect(url.searchParams.getAll("include_annotation_names")).toEqual([
      "note",
    ]);
  });

  it("rejects missing --identifier and --trace-ids before any HTTP call", async () => {
    const fetchMock = makeFetchMock([PROJECT_RESPONSE]);
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "log").mockImplementation(() => {});
    const stderrSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(((
      code?: number
    ) => {
      throw new Error(`process.exit:${code}`);
    }) as never);

    await expect(
      createTraceCommand().parseAsync(
        ["list-annotations", "--format", "raw", ...BASE_ARGS],
        { from: "user" }
      )
    ).rejects.toThrow(`process.exit:${ExitCode.INVALID_ARGUMENT}`);

    expect(exitSpy).toHaveBeenCalledWith(ExitCode.INVALID_ARGUMENT);
    expect(fetchMock).not.toHaveBeenCalled();
    // Structured error in raw mode: parseable JSON envelope
    const stderrCall = stderrSpy.mock.calls[0]?.[0];
    const parsed = JSON.parse(String(stderrCall));
    expect(parsed.code).toBe("INVALID_ARGUMENT");
    expect(parsed.error).toMatch(/identifier|trace-ids/);
  });

  it("envelopes the array under `annotations` in json mode (D6)", async () => {
    const fetchMock = makeFetchMock([
      PROJECT_RESPONSE,
      {
        ok: true,
        body: { data: [TRACE_ANNOTATION_ROW], next_cursor: null },
      },
    ]);
    vi.stubGlobal("fetch", fetchMock);
    const stdoutSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});

    await createTraceCommand().parseAsync(
      [
        "list-annotations",
        "--identifier",
        "coding-session:demo",
        "--format",
        "json",
        ...BASE_ARGS,
      ],
      { from: "user" }
    );

    const output = stdoutSpy.mock.calls[0]?.[0];
    const parsed = JSON.parse(String(output));
    expect(parsed).toEqual({ annotations: [TRACE_ANNOTATION_ROW] });
  });
});

describe("span list-annotations", () => {
  it("filters by --identifier on /span_annotations", async () => {
    const fetchMock = makeFetchMock([
      PROJECT_RESPONSE,
      {
        ok: true,
        body: { data: [SPAN_ANNOTATION_ROW], next_cursor: null },
      },
    ]);
    vi.stubGlobal("fetch", fetchMock);
    const stdoutSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});

    await createSpanCommand().parseAsync(
      [
        "list-annotations",
        "--identifier",
        "coding-session:demo",
        "--format",
        "raw",
        ...BASE_ARGS,
      ],
      { from: "user" }
    );

    const url = new URL(getFetchUrl(fetchMock.mock.calls[1][0]));
    expect(url.pathname).toBe("/v1/projects/project-default/span_annotations");
    expect(url.searchParams.getAll("identifier")).toEqual([
      "coding-session:demo",
    ]);
    const output = stdoutSpy.mock.calls[0]?.[0];
    expect(JSON.parse(String(output))).toEqual([SPAN_ANNOTATION_ROW]);
  });

  it("rejects missing --identifier and --span-ids", async () => {
    const fetchMock = makeFetchMock([PROJECT_RESPONSE]);
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "error").mockImplementation(() => {});
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(((
      code?: number
    ) => {
      throw new Error(`process.exit:${code}`);
    }) as never);

    await expect(
      createSpanCommand().parseAsync(["list-annotations", ...BASE_ARGS], {
        from: "user",
      })
    ).rejects.toThrow(`process.exit:${ExitCode.INVALID_ARGUMENT}`);

    expect(exitSpy).toHaveBeenCalledWith(ExitCode.INVALID_ARGUMENT);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("session list-annotations", () => {
  it("filters by --identifier on /session_annotations", async () => {
    const fetchMock = makeFetchMock([
      PROJECT_RESPONSE,
      {
        ok: true,
        body: { data: [SESSION_ANNOTATION_ROW], next_cursor: null },
      },
    ]);
    vi.stubGlobal("fetch", fetchMock);
    const stdoutSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});

    await createSessionCommand().parseAsync(
      [
        "list-annotations",
        "--identifier",
        "coding-session:demo",
        "--format",
        "raw",
        ...BASE_ARGS,
      ],
      { from: "user" }
    );

    const url = new URL(getFetchUrl(fetchMock.mock.calls[1][0]));
    expect(url.pathname).toBe(
      "/v1/projects/project-default/session_annotations"
    );
    expect(url.searchParams.getAll("identifier")).toEqual([
      "coding-session:demo",
    ]);
    const output = stdoutSpy.mock.calls[0]?.[0];
    expect(JSON.parse(String(output))).toEqual([SESSION_ANNOTATION_ROW]);
  });

  it("threads multiple --include-name and --exclude-name values through unchanged", async () => {
    const fetchMock = makeFetchMock([
      PROJECT_RESPONSE,
      { ok: true, body: { data: [], next_cursor: null } },
    ]);
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});

    await createSessionCommand().parseAsync(
      [
        "list-annotations",
        "--identifier",
        "coding-session:demo",
        "--include-name",
        "axial_coding_category",
        "--include-name",
        "note",
        "--exclude-name",
        "deprecated",
        "--format",
        "raw",
        ...BASE_ARGS,
      ],
      { from: "user" }
    );

    const url = new URL(getFetchUrl(fetchMock.mock.calls[1][0]));
    expect(url.searchParams.getAll("include_annotation_names")).toEqual([
      "axial_coding_category",
      "note",
    ]);
    expect(url.searchParams.getAll("exclude_annotation_names")).toEqual([
      "deprecated",
    ]);
  });

  it("rejects missing --identifier and --session-ids", async () => {
    const fetchMock = makeFetchMock([PROJECT_RESPONSE]);
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "error").mockImplementation(() => {});
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(((
      code?: number
    ) => {
      throw new Error(`process.exit:${code}`);
    }) as never);

    await expect(
      createSessionCommand().parseAsync(["list-annotations", ...BASE_ARGS], {
        from: "user",
      })
    ).rejects.toThrow(`process.exit:${ExitCode.INVALID_ARGUMENT}`);

    expect(exitSpy).toHaveBeenCalledWith(ExitCode.INVALID_ARGUMENT);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
