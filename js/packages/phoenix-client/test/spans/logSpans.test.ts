import { createHttp } from "@arizeai/phoenix-testing";
import { createMockServer, type Server } from "@arizeai/phoenix-testing/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { logSpans, SpanCreationError } from "../../src/spans/logSpans";
import type { Span } from "../../src/spans/logSpans";
import { createTestClient } from "../testUtils";

const http = createHttp();

const testSpan: Span = {
  name: "test-span",
  context: {
    trace_id: "0123456789abcdef0123456789abcdef",
    span_id: "0123456789abcdef",
  },
  span_kind: "CHAIN",
  start_time: "2024-01-01T00:00:00Z",
  end_time: "2024-01-01T00:00:01Z",
  status_code: "OK",
};

let server: Server;

beforeAll(async () => {
  server = await createMockServer();
  server.listen({ onUnhandledRequest: "error" });
});

afterEach(() => {
  server.resetHandlers();
});

afterAll(() => {
  server.close();
});

describe("logSpans", () => {
  it("logs spans to a project by name", async () => {
    let receivedProjectIdentifier: string | undefined;
    let receivedRequestBody: { data: Span[] } | undefined;

    server.use(
      http.post(
        "/v1/projects/{project_identifier}/spans",
        async ({ params, request, response }) => {
          receivedProjectIdentifier = params.project_identifier;
          receivedRequestBody = await request.json();
          return response(202).json({
            total_received: receivedRequestBody.data.length,
            total_queued: receivedRequestBody.data.length,
          });
        }
      )
    );

    const result = await logSpans({
      client: createTestClient(),
      project: { projectName: "my-project" },
      spans: [testSpan],
    });

    expect(result).toEqual({ totalReceived: 1, totalQueued: 1 });
    expect(receivedProjectIdentifier).toBe("my-project");
    expect(receivedRequestBody).toEqual({ data: [testSpan] });
  });

  it("resolves a project identifier passed via `project`", async () => {
    let receivedProjectIdentifier: string | undefined;

    server.use(
      http.post(
        "/v1/projects/{project_identifier}/spans",
        ({ params, response }) => {
          receivedProjectIdentifier = params.project_identifier;
          return response(202).json({
            total_received: 1,
            total_queued: 1,
          });
        }
      )
    );

    await logSpans({
      client: createTestClient(),
      project: { project: "some-id-or-name" },
      spans: [testSpan],
    });

    expect(receivedProjectIdentifier).toBe("some-id-or-name");
  });

  it("throws a SpanCreationError with parsed details on a 400 response", async () => {
    const errorDetail = {
      error: "Request contains invalid or duplicate spans",
      total_received: 2,
      total_queued: 0,
      total_duplicates: 1,
      total_invalid: 1,
      duplicate_spans: [{ span_id: "dup-1", trace_id: "trace-1" }],
      invalid_spans: [
        { span_id: "bad-1", trace_id: "trace-2", error: "bad span_kind" },
      ],
    };
    server.use(
      http.post("/v1/projects/{project_identifier}/spans", ({ response }) =>
        response.untyped(
          new Response(
            JSON.stringify({ detail: JSON.stringify(errorDetail) }),
            {
              status: 400,
              headers: { "Content-Type": "application/json" },
            }
          )
        )
      )
    );

    let thrown: unknown;
    try {
      await logSpans({
        client: createTestClient(),
        project: { projectName: "my-project" },
        spans: [testSpan, testSpan],
      });
    } catch (e) {
      thrown = e;
    }

    expect(thrown).toBeInstanceOf(SpanCreationError);
    if (!(thrown instanceof SpanCreationError)) return;
    const err = thrown;
    expect(err.totalReceived).toBe(2);
    expect(err.totalQueued).toBe(0);
    expect(err.totalInvalid).toBe(1);
    expect(err.totalDuplicates).toBe(1);
    expect(err.invalidSpans).toEqual([
      { spanId: "bad-1", traceId: "trace-2", error: "bad span_kind" },
    ]);
    expect(err.duplicateSpans).toEqual([
      { spanId: "dup-1", traceId: "trace-1" },
    ]);
    expect(err.message).toContain("Failed to queue 1 invalid spans");
    expect(err.message).toContain("Found 1 duplicate spans");
  });

  it("throws a SpanCreationError parsed from a 422 validation error array", async () => {
    // Only the span at index 1 is flagged, but a FastAPI 422 rejects the
    // entire request body, so totalQueued must be 0 (all-or-nothing contract).
    server.use(
      http.post("/v1/projects/{project_identifier}/spans", ({ response }) =>
        response(422).json({
          detail: [
            {
              loc: ["body", "data", 1],
              msg: "field required",
              type: "value_error.missing",
            },
          ],
        })
      )
    );

    const spans: Span[] = [
      { ...testSpan, context: { trace_id: "trace-1", span_id: "span-1" } },
      { ...testSpan, context: { trace_id: "trace-2", span_id: "span-2" } },
      { ...testSpan, context: { trace_id: "trace-3", span_id: "span-3" } },
    ];

    let thrown: unknown;
    try {
      await logSpans({
        client: createTestClient(),
        project: { projectName: "my-project" },
        spans,
      });
    } catch (e) {
      thrown = e;
    }

    expect(thrown).toBeInstanceOf(SpanCreationError);
    if (!(thrown instanceof SpanCreationError)) return;
    const err = thrown;
    expect(err.totalReceived).toBe(3);
    expect(err.totalQueued).toBe(0);
    expect(err.invalidSpans).toEqual([
      { spanId: "span-2", traceId: "trace-2", error: "field required" },
    ]);
  });

  it("throws a generic error for unrecognized error shapes", async () => {
    server.use(
      http.post("/v1/projects/{project_identifier}/spans", ({ response }) =>
        response.untyped(
          new Response(
            JSON.stringify({ status: 500, message: "Internal Server Error" }),
            {
              status: 500,
              headers: { "Content-Type": "application/json" },
            }
          )
        )
      )
    );

    await expect(
      logSpans({
        client: createTestClient(),
        project: { projectName: "my-project" },
        spans: [testSpan],
      })
    ).rejects.toThrow("Failed to log spans:");
  });
});
