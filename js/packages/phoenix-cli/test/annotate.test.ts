import { HttpResponse } from "@arizeai/phoenix-testing";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { AnnotationMutationResult } from "../src/commands/annotationMutations";
import { formatAnnotationMutationOutput } from "../src/commands/formatAnnotationMutation";
import { createSpanCommand } from "../src/commands/span";
import { createTraceCommand } from "../src/commands/trace";
import { ExitCode } from "../src/exitCodes";
import { http, setupMockPhoenixServer } from "./mockServer";
import { BASE_ARGS, captureCliOutput, mockProcessExit } from "./testUtils";

const mock = setupMockPhoenixServer();

interface CapturedAnnotationRequest {
  query?: URLSearchParams;
  body?: unknown;
  count: number;
}

/**
 * Pin the span_annotations POST endpoint to a fixed inserted ID and record the
 * request's query string, JSON body, and call count for later assertions.
 */
function captureSpanAnnotationsRequest(insertedId: string) {
  const captured: CapturedAnnotationRequest = { count: 0 };
  mock.server.use(
    http.post("/v1/span_annotations", async ({ request, response }) => {
      captured.count += 1;
      captured.query = new URL(request.url).searchParams;
      captured.body = await request.clone().json();
      return response(200).json({ data: [{ id: insertedId }] });
    })
  );
  return captured;
}

/**
 * Pin the trace_annotations POST endpoint to a fixed inserted ID and record
 * the request's query string, JSON body, and call count for later assertions.
 */
function captureTraceAnnotationsRequest(insertedId: string) {
  const captured: CapturedAnnotationRequest = { count: 0 };
  mock.server.use(
    http.post("/v1/trace_annotations", async ({ request, response }) => {
      captured.count += 1;
      captured.query = new URL(request.url).searchParams;
      captured.body = await request.clone().json();
      return response(200).json({ data: [{ id: insertedId }] });
    })
  );
  return captured;
}

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
  });

  it("posts a sync span annotation and returns raw structured output", async () => {
    const captured = captureSpanAnnotationsRequest("span-annotation-1");
    const io = captureCliOutput();

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

    expect(captured.count).toBe(1);
    expect(captured.query?.get("sync")).toBe("true");
    expect(captured.body).toEqual({
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
    expect(io.stdout).toHaveBeenCalledWith(
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
    expect(io.stderr).not.toHaveBeenCalled();
  });

  it("passes through a custom annotator kind for span annotation", async () => {
    const captured = captureSpanAnnotationsRequest("span-annotation-3");
    const io = captureCliOutput();

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

    expect(captured.body).toEqual({
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
    expect(io.stdout).toHaveBeenCalledWith(
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
    captureSpanAnnotationsRequest("span-annotation-2");
    const io = captureCliOutput();

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

    expect(io.stdout).toHaveBeenCalledWith(
      expect.stringContaining("Target: span span-456")
    );
    expect(io.stdout).toHaveBeenCalledWith(
      expect.stringContaining("Explanation: looks good")
    );
  });

  it("fails with INVALID_ARGUMENT when --name is missing", async () => {
    const captured = captureSpanAnnotationsRequest("span-annotation-unused");
    vi.spyOn(console, "error").mockImplementation(() => {});
    const exitSpy = mockProcessExit();

    await expect(
      createSpanCommand().parseAsync(
        ["annotate", "span-123", "--label", "pass", ...BASE_ARGS],
        { from: "user" }
      )
    ).rejects.toThrow(`process.exit:${ExitCode.INVALID_ARGUMENT}`);

    expect(exitSpy).toHaveBeenCalledWith(ExitCode.INVALID_ARGUMENT);
    expect(captured.count).toBe(0);
  });

  it("fails with INVALID_ARGUMENT when all result fields are blank", async () => {
    const captured = captureSpanAnnotationsRequest("span-annotation-unused");
    vi.spyOn(console, "error").mockImplementation(() => {});
    const exitSpy = mockProcessExit();

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
    expect(captured.count).toBe(0);
  });

  it("fails with INVALID_ARGUMENT when --score is invalid", async () => {
    const captured = captureSpanAnnotationsRequest("span-annotation-unused");
    const stderrSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const exitSpy = mockProcessExit();

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
    expect(captured.count).toBe(0);
    expect(stderrSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        "Invalid value for --score: not-a-number. Expected a finite number."
      )
    );
  });

  it("fails with INVALID_ARGUMENT when --score contains trailing non-numeric characters", async () => {
    const captured = captureSpanAnnotationsRequest("span-annotation-unused");
    const stderrSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const exitSpy = mockProcessExit();

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
    expect(captured.count).toBe(0);
    expect(stderrSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        "Invalid value for --score: 0abc. Expected a finite number."
      )
    );
  });

  it("fails with INVALID_ARGUMENT when --annotator-kind is invalid", async () => {
    const captured = captureSpanAnnotationsRequest("span-annotation-unused");
    vi.spyOn(console, "error").mockImplementation(() => {});
    const exitSpy = mockProcessExit();

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
    expect(captured.count).toBe(0);
  });

  it("surfaces 404 API errors", async () => {
    mock.server.use(
      http.post("/v1/span_annotations", ({ response }) =>
        response(404).text("Spans with IDs missing-span do not exist.")
      )
    );
    const stderrSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const exitSpy = mockProcessExit();

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
    mock.server.use(
      http.post("/v1/span_annotations", () => HttpResponse.error())
    );
    vi.spyOn(console, "error").mockImplementation(() => {});
    const exitSpy = mockProcessExit();

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
  });

  it("posts a sync trace annotation and returns json output", async () => {
    const captured = captureTraceAnnotationsRequest("trace-annotation-1");
    const io = captureCliOutput();

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

    expect(captured.count).toBe(1);
    expect(captured.query?.get("sync")).toBe("true");
    expect(captured.body).toEqual({
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
    expect(io.stdout).toHaveBeenCalledWith(
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
    const captured = captureTraceAnnotationsRequest("trace-annotation-2");
    const io = captureCliOutput();

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

    expect(captured.body).toEqual({
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
    expect(io.stdout).toHaveBeenCalledWith(
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
    mock.server.use(
      http.post("/v1/trace_annotations", ({ response }) =>
        response.untyped(
          HttpResponse.json(
            { detail: "Internal server error" },
            {
              status: 500,
            }
          )
        )
      )
    );
    const stderrSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const exitSpy = mockProcessExit();

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
    const captured = captureTraceAnnotationsRequest("trace-annotation-unused");
    const stderrSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const exitSpy = mockProcessExit();

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
    expect(captured.count).toBe(0);
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
  });

  it("uses the resolved full trace ID when fetching trace annotations for a prefix lookup", async () => {
    const resolvedTraceId = "trace-1234567890abcdef";
    const traceIdPrefix = "trace-1234";
    const capturedTraceAnnotations: { query?: URLSearchParams } = {};

    mock.server.use(
      http.get("/v1/projects/{project_identifier}", ({ response }) =>
        response(200).json({
          data: { id: "project-default", name: "default" },
        })
      ),
      http.get("/v1/projects/{project_identifier}/spans", ({ response }) =>
        response(200).json({
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
        })
      ),
      http.get(
        "/v1/projects/{project_identifier}/trace_annotations",
        ({ request, response }) => {
          capturedTraceAnnotations.query = new URL(request.url).searchParams;
          return response(200).json({ data: [], next_cursor: null });
        }
      ),
      http.get(
        "/v1/projects/{project_identifier}/span_annotations",
        ({ response }) => response(200).json({ data: [], next_cursor: null })
      )
    );
    captureCliOutput();

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

    expect(capturedTraceAnnotations.query?.getAll("trace_ids")).toEqual([
      resolvedTraceId,
    ]);
  });

  it("includes trace and span annotations in raw output when requested", async () => {
    const captured: {
      traceAnnotationsProject?: string;
      spanAnnotationsProject?: string;
    } = {};

    mock.server.use(
      http.get("/v1/projects/{project_identifier}", ({ response }) =>
        response(200).json({
          data: { id: "project-default", name: "default" },
        })
      ),
      http.get("/v1/projects/{project_identifier}/spans", ({ response }) =>
        response(200).json({
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
        })
      ),
      http.get(
        "/v1/projects/{project_identifier}/trace_annotations",
        ({ params, response }) => {
          captured.traceAnnotationsProject = params.project_identifier;
          return response(200).json({
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
          });
        }
      ),
      http.get(
        "/v1/projects/{project_identifier}/span_annotations",
        ({ params, response }) => {
          captured.spanAnnotationsProject = params.project_identifier;
          return response(200).json({
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
          });
        }
      )
    );
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

    expect(captured.traceAnnotationsProject).toBe("project-default");
    expect(captured.spanAnnotationsProject).toBe("project-default");

    const output = io.stdout.mock.calls[0]?.[0];
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

describe("annotate --identifier round-trip", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("threads --identifier into the span_annotations request body", async () => {
    const captured = captureSpanAnnotationsRequest("span-annotation-id");
    captureCliOutput();

    await createSpanCommand().parseAsync(
      [
        "annotate",
        "span-123",
        "--name",
        "axial_coding_category",
        "--label",
        "off-topic",
        "--identifier",
        "px-coding-session:abc12345",
        "--format",
        "raw",
        ...BASE_ARGS,
      ],
      { from: "user" }
    );

    expect(captured.body).toEqual({
      data: [
        {
          span_id: "span-123",
          name: "axial_coding_category",
          annotator_kind: "HUMAN",
          result: { label: "off-topic" },
          identifier: "px-coding-session:abc12345",
        },
      ],
    });
  });

  it("threads --identifier into the trace_annotations request body", async () => {
    const captured = captureTraceAnnotationsRequest("trace-annotation-id");
    captureCliOutput();

    await createTraceCommand().parseAsync(
      [
        "annotate",
        "trace-123",
        "--name",
        "axial_coding_category",
        "--label",
        "off-topic",
        "--identifier",
        "px-coding-session:abc12345",
        "--format",
        "raw",
        ...BASE_ARGS,
      ],
      { from: "user" }
    );

    expect(captured.body).toEqual({
      data: [
        {
          trace_id: "trace-123",
          name: "axial_coding_category",
          annotator_kind: "HUMAN",
          result: { label: "off-topic" },
          identifier: "px-coding-session:abc12345",
        },
      ],
    });
  });

  it("echoes the supplied --identifier in the raw mutation result", async () => {
    captureTraceAnnotationsRequest("trace-annotation-id");
    const io = captureCliOutput();

    await createTraceCommand().parseAsync(
      [
        "annotate",
        "trace-123",
        "--name",
        "axial_coding_category",
        "--label",
        "off-topic",
        "--identifier",
        "px-coding-session:abc12345",
        "--format",
        "raw",
        ...BASE_ARGS,
      ],
      { from: "user" }
    );

    const echoed = JSON.parse(String(io.stdout.mock.calls[0]?.[0]));
    expect(echoed.identifier).toBe("px-coding-session:abc12345");
  });
});
