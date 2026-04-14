import { afterEach, describe, expect, it, vi } from "vitest";

import type { AnnotationMutationResult } from "../src/commands/annotationMutationUtils";
import { formatAnnotationMutationOutput } from "../src/commands/formatAnnotationMutation";
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

const BASE_ARGS = ["--endpoint", "http://localhost:6006", "--no-progress"];

describe("formatAnnotationMutationOutput", () => {
  const annotation: AnnotationMutationResult = {
    id: "annotation-123",
    targetType: "span",
    targetId: "span-456",
    name: "reviewer",
    label: "pass",
    score: 0.9,
    explanation: "looks good",
    annotatorKind: "HUMAN",
    identifier: "",
  };

  it("formats pretty output for humans", () => {
    const output = formatAnnotationMutationOutput({ annotation });
    expect(output).toContain("Annotation upserted");
    expect(output).toContain("ID: annotation-123");
    expect(output).toContain("Target: span span-456");
    expect(output).toContain("Name: reviewer");
  });

  it("formats json output", () => {
    const output = formatAnnotationMutationOutput({
      annotation,
      format: "json",
    });
    expect(output).toBe(JSON.stringify(annotation, null, 2));
  });

  it("formats raw output", () => {
    const output = formatAnnotationMutationOutput({
      annotation,
      format: "raw",
    });
    expect(output).toBe(JSON.stringify(annotation));
  });
});

describe("span annotate", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("posts a sync span annotation and returns raw structured output", async () => {
    const fetchMock = makeFetchMock([
      {
        ok: true,
        body: { data: [{ id: "span-annotation-1" }] },
      },
    ]);
    vi.stubGlobal("fetch", fetchMock);
    const stdoutSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const stderrSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await createSpanCommand().parseAsync(
      [
        "annotate",
        "span-123",
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

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(getFetchUrl(fetchMock.mock.calls[0][0])).toContain(
      "/v1/span_annotations"
    );
    expect(getFetchUrl(fetchMock.mock.calls[0][0])).toContain("sync=true");
    expect(
      getFetchMethod(fetchMock.mock.calls[0][0], fetchMock.mock.calls[0][1])
    ).toBe("POST");
    await expect(
      getFetchBody(fetchMock.mock.calls[0][0], fetchMock.mock.calls[0][1])
    ).resolves.toEqual({
      data: [
        {
          span_id: "span-123",
          name: "reviewer",
          annotator_kind: "HUMAN",
          result: { label: "pass" },
          identifier: "",
        },
      ],
    });
    expect(stdoutSpy).toHaveBeenCalledWith(
      JSON.stringify({
        id: "span-annotation-1",
        targetType: "span",
        targetId: "span-123",
        name: "reviewer",
        label: "pass",
        score: null,
        explanation: null,
        annotatorKind: "HUMAN",
        identifier: "",
      })
    );
    expect(stderrSpy).not.toHaveBeenCalled();
  });

  it("passes through a custom annotator kind for span annotation", async () => {
    const fetchMock = makeFetchMock([
      {
        ok: true,
        body: { data: [{ id: "span-annotation-3" }] },
      },
    ]);
    vi.stubGlobal("fetch", fetchMock);
    const stdoutSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});

    await createSpanCommand().parseAsync(
      [
        "annotate",
        "span-789",
        "--name",
        "reviewer",
        "--label",
        "pass",
        "--annotator-kind",
        "code",
        "--format",
        "raw",
        ...BASE_ARGS,
      ],
      { from: "user" }
    );

    await expect(
      getFetchBody(fetchMock.mock.calls[0][0], fetchMock.mock.calls[0][1])
    ).resolves.toEqual({
      data: [
        {
          span_id: "span-789",
          name: "reviewer",
          annotator_kind: "CODE",
          result: { label: "pass" },
          identifier: "",
        },
      ],
    });
    expect(stdoutSpy).toHaveBeenCalledWith(
      JSON.stringify({
        id: "span-annotation-3",
        targetType: "span",
        targetId: "span-789",
        name: "reviewer",
        label: "pass",
        score: null,
        explanation: null,
        annotatorKind: "CODE",
        identifier: "",
      })
    );
  });

  it("returns pretty output for a scored span annotation", async () => {
    const fetchMock = makeFetchMock([
      {
        ok: true,
        body: { data: [{ id: "span-annotation-2" }] },
      },
    ]);
    vi.stubGlobal("fetch", fetchMock);
    const stdoutSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});

    await createSpanCommand().parseAsync(
      [
        "annotate",
        "span-456",
        "--name",
        "reviewer",
        "--score",
        "0.9",
        "--explanation",
        " looks good ",
        ...BASE_ARGS,
      ],
      { from: "user" }
    );

    expect(stdoutSpy).toHaveBeenCalledWith(
      expect.stringContaining("Target: span span-456")
    );
    expect(stdoutSpy).toHaveBeenCalledWith(
      expect.stringContaining("Explanation: looks good")
    );
  });

  it("fails with INVALID_ARGUMENT when --name is missing", async () => {
    const fetchMock = makeFetchMock([{ ok: true, body: {} }]);
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "error").mockImplementation(() => {});
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(((
      code?: number
    ) => {
      throw new Error(`process.exit:${code}`);
    }) as never);

    await expect(
      createSpanCommand().parseAsync(
        ["annotate", "span-123", "--label", "pass", ...BASE_ARGS],
        { from: "user" }
      )
    ).rejects.toThrow(`process.exit:${ExitCode.INVALID_ARGUMENT}`);

    expect(exitSpy).toHaveBeenCalledWith(ExitCode.INVALID_ARGUMENT);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fails with INVALID_ARGUMENT when all result fields are blank", async () => {
    const fetchMock = makeFetchMock([{ ok: true, body: {} }]);
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "error").mockImplementation(() => {});
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(((
      code?: number
    ) => {
      throw new Error(`process.exit:${code}`);
    }) as never);

    await expect(
      createSpanCommand().parseAsync(
        [
          "annotate",
          "span-123",
          "--name",
          "reviewer",
          "--label",
          "   ",
          "--explanation",
          "   ",
          ...BASE_ARGS,
        ],
        { from: "user" }
      )
    ).rejects.toThrow(`process.exit:${ExitCode.INVALID_ARGUMENT}`);

    expect(exitSpy).toHaveBeenCalledWith(ExitCode.INVALID_ARGUMENT);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fails with INVALID_ARGUMENT when --score is invalid", async () => {
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
        [
          "annotate",
          "span-123",
          "--name",
          "reviewer",
          "--score",
          "not-a-number",
          ...BASE_ARGS,
        ],
        { from: "user" }
      )
    ).rejects.toThrow(`process.exit:${ExitCode.INVALID_ARGUMENT}`);

    expect(exitSpy).toHaveBeenCalledWith(ExitCode.INVALID_ARGUMENT);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(stderrSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        "Invalid value for --score: not-a-number. Expected a finite number."
      )
    );
  });

  it("fails with INVALID_ARGUMENT when --score contains trailing non-numeric characters", async () => {
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
        [
          "annotate",
          "span-123",
          "--name",
          "reviewer",
          "--score",
          "0abc",
          ...BASE_ARGS,
        ],
        { from: "user" }
      )
    ).rejects.toThrow(`process.exit:${ExitCode.INVALID_ARGUMENT}`);

    expect(exitSpy).toHaveBeenCalledWith(ExitCode.INVALID_ARGUMENT);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(stderrSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        "Invalid value for --score: 0abc. Expected a finite number."
      )
    );
  });

  it("fails with INVALID_ARGUMENT when --annotator-kind is invalid", async () => {
    const fetchMock = makeFetchMock([{ ok: true, body: {} }]);
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "error").mockImplementation(() => {});
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(((
      code?: number
    ) => {
      throw new Error(`process.exit:${code}`);
    }) as never);

    await expect(
      createSpanCommand().parseAsync(
        [
          "annotate",
          "span-123",
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
  });

  it("surfaces 404 API errors", async () => {
    const fetchMock = makeFetchMock([
      {
        ok: false,
        status: 404,
        body: { detail: "Spans with IDs missing-span do not exist." },
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
      createSpanCommand().parseAsync(
        [
          "annotate",
          "missing-span",
          "--name",
          "reviewer",
          "--label",
          "pass",
          ...BASE_ARGS,
        ],
        { from: "user" }
      )
    ).rejects.toThrow(`process.exit:${ExitCode.FAILURE}`);

    expect(exitSpy).toHaveBeenCalledWith(ExitCode.FAILURE);
    expect(stderrSpy).toHaveBeenCalledWith(
      expect.stringContaining("Error annotating span:")
    );
    expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining("404"));
  });

  it("uses NETWORK_ERROR on fetch failures", async () => {
    const fetchMock = makeFetchMock([
      {
        error: new TypeError("fetch failed"),
      },
    ]);
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "error").mockImplementation(() => {});
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(((
      code?: number
    ) => {
      throw new Error(`process.exit:${code}`);
    }) as never);

    await expect(
      createSpanCommand().parseAsync(
        [
          "annotate",
          "span-123",
          "--name",
          "reviewer",
          "--label",
          "pass",
          ...BASE_ARGS,
        ],
        { from: "user" }
      )
    ).rejects.toThrow(`process.exit:${ExitCode.NETWORK_ERROR}`);

    expect(exitSpy).toHaveBeenCalledWith(ExitCode.NETWORK_ERROR);
  });
});

describe("trace annotate", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("posts a sync trace annotation and returns json output", async () => {
    const fetchMock = makeFetchMock([
      {
        ok: true,
        body: { data: [{ id: "trace-annotation-1" }] },
      },
    ]);
    vi.stubGlobal("fetch", fetchMock);
    const stdoutSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});

    await createTraceCommand().parseAsync(
      [
        "annotate",
        "trace-123",
        "--name",
        "reviewer",
        "--score",
        "0.5",
        "--format",
        "json",
        ...BASE_ARGS,
      ],
      { from: "user" }
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(getFetchUrl(fetchMock.mock.calls[0][0])).toContain(
      "/v1/trace_annotations"
    );
    expect(getFetchUrl(fetchMock.mock.calls[0][0])).toContain("sync=true");
    await expect(
      getFetchBody(fetchMock.mock.calls[0][0], fetchMock.mock.calls[0][1])
    ).resolves.toEqual({
      data: [
        {
          trace_id: "trace-123",
          name: "reviewer",
          annotator_kind: "HUMAN",
          result: { score: 0.5 },
          identifier: "",
        },
      ],
    });
    expect(stdoutSpy).toHaveBeenCalledWith(
      JSON.stringify(
        {
          id: "trace-annotation-1",
          targetType: "trace",
          targetId: "trace-123",
          name: "reviewer",
          label: null,
          score: 0.5,
          explanation: null,
          annotatorKind: "HUMAN",
          identifier: "",
        },
        null,
        2
      )
    );
  });

  it("passes through a custom annotator kind for trace annotation", async () => {
    const fetchMock = makeFetchMock([
      {
        ok: true,
        body: { data: [{ id: "trace-annotation-2" }] },
      },
    ]);
    vi.stubGlobal("fetch", fetchMock);
    const stdoutSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});

    await createTraceCommand().parseAsync(
      [
        "annotate",
        "trace-456",
        "--name",
        "reviewer",
        "--score",
        "0.7",
        "--annotator-kind",
        "llm",
        "--format",
        "raw",
        ...BASE_ARGS,
      ],
      { from: "user" }
    );

    await expect(
      getFetchBody(fetchMock.mock.calls[0][0], fetchMock.mock.calls[0][1])
    ).resolves.toEqual({
      data: [
        {
          trace_id: "trace-456",
          name: "reviewer",
          annotator_kind: "LLM",
          result: { score: 0.7 },
          identifier: "",
        },
      ],
    });
    expect(stdoutSpy).toHaveBeenCalledWith(
      JSON.stringify({
        id: "trace-annotation-2",
        targetType: "trace",
        targetId: "trace-456",
        name: "reviewer",
        label: null,
        score: 0.7,
        explanation: null,
        annotatorKind: "LLM",
        identifier: "",
      })
    );
  });

  it("surfaces 500 API errors for trace annotation", async () => {
    const fetchMock = makeFetchMock([
      {
        ok: false,
        status: 500,
        body: { detail: "Internal server error" },
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
      createTraceCommand().parseAsync(
        [
          "annotate",
          "trace-123",
          "--name",
          "reviewer",
          "--label",
          "pass",
          ...BASE_ARGS,
        ],
        { from: "user" }
      )
    ).rejects.toThrow(`process.exit:${ExitCode.FAILURE}`);

    expect(exitSpy).toHaveBeenCalledWith(ExitCode.FAILURE);
    expect(stderrSpy).toHaveBeenCalledWith(
      expect.stringContaining("Error annotating trace:")
    );
    expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining("500"));
  });

  it("fails with INVALID_ARGUMENT when trace --score is invalid", async () => {
    const fetchMock = makeFetchMock([{ ok: true, body: {} }]);
    vi.stubGlobal("fetch", fetchMock);
    const stderrSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(((
      code?: number
    ) => {
      throw new Error(`process.exit:${code}`);
    }) as never);

    await expect(
      createTraceCommand().parseAsync(
        [
          "annotate",
          "trace-123",
          "--name",
          "reviewer",
          "--score",
          "NaN-ish",
          ...BASE_ARGS,
        ],
        { from: "user" }
      )
    ).rejects.toThrow(`process.exit:${ExitCode.INVALID_ARGUMENT}`);

    expect(exitSpy).toHaveBeenCalledWith(ExitCode.INVALID_ARGUMENT);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(stderrSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        "Invalid value for --score: NaN-ish. Expected a finite number."
      )
    );
  });
});

describe("trace get", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("uses the resolved full trace ID when fetching trace annotations for a prefix lookup", async () => {
    const resolvedTraceId = "trace-1234567890abcdef";
    const traceIdPrefix = "trace-1234";
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
                trace_id: resolvedTraceId,
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
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});

    await createTraceCommand().parseAsync(
      [
        "get",
        traceIdPrefix,
        "--project",
        "default",
        "--include-annotations",
        "--format",
        "raw",
        ...BASE_ARGS,
      ],
      { from: "user" }
    );

    expect(fetchMock).toHaveBeenCalledTimes(4);
    const traceAnnotationsUrl = new URL(
      getFetchUrl(fetchMock.mock.calls[2][0])
    );
    expect(traceAnnotationsUrl.searchParams.getAll("trace_ids")).toEqual([
      resolvedTraceId,
    ]);
  });

  it("includes trace and span annotations in raw output when requested", async () => {
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
              id: "trace-annotation-1",
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
              id: "span-annotation-1",
              created_at: "2026-01-13T10:00:00.750Z",
              updated_at: "2026-01-13T10:00:00.750Z",
              source: "API",
              user_id: null,
              name: "accuracy",
              annotator_kind: "CODE",
              result: {
                score: 0.9,
              },
              metadata: null,
              identifier: "",
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
        "--include-annotations",
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
    expect(getFetchUrl(fetchMock.mock.calls[3][0])).toContain(
      "/v1/projects/project-default/span_annotations"
    );

    const output = stdoutSpy.mock.calls[0]?.[0];
    expect(output).toBeTruthy();

    const parsedOutput = JSON.parse(String(output));
    expect(parsedOutput.annotations).toEqual([
      expect.objectContaining({
        id: "trace-annotation-1",
        name: "reviewer",
        trace_id: "trace-123",
      }),
    ]);
    expect(parsedOutput.spans[0].annotations).toEqual([
      expect.objectContaining({
        id: "span-annotation-1",
        name: "accuracy",
        span_id: "span-123",
      }),
    ]);
  });
});
