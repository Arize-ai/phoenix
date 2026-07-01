import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Span } from "../../src/spans/logSpans";
import { logSpans, SpanCreationError } from "../../src/spans/logSpans";

// Mock the fetch module with an inspectable mock
const mockPost = vi.fn();
vi.mock("openapi-fetch", () => ({
  default: () => ({
    POST: mockPost,
    use: () => {},
  }),
}));

const testSpan: Span = {
  name: "test-span",
  context: {
    trace_id: "trace-123",
    span_id: "span-456",
  },
  span_kind: "CHAIN",
  start_time: "2024-01-01T00:00:00Z",
  end_time: "2024-01-01T00:00:01Z",
  status_code: "OK",
};

describe("logSpans", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("logs spans to a project by name", async () => {
    mockPost.mockResolvedValue({
      data: { total_received: 1, total_queued: 1 },
      error: null,
    });

    const result = await logSpans({
      project: { projectName: "my-project" },
      spans: [testSpan],
    });

    expect(result).toEqual({ totalReceived: 1, totalQueued: 1 });
    expect(mockPost).toHaveBeenCalledWith(
      "/v1/projects/{project_identifier}/spans",
      {
        params: { path: { project_identifier: "my-project" } },
        body: { data: [testSpan] },
      }
    );
  });

  it("resolves a project identifier passed via `project`", async () => {
    mockPost.mockResolvedValue({
      data: { total_received: 1, total_queued: 1 },
      error: null,
    });

    await logSpans({
      project: { project: "some-id-or-name" },
      spans: [testSpan],
    });

    expect(mockPost).toHaveBeenCalledWith(
      "/v1/projects/{project_identifier}/spans",
      expect.objectContaining({
        params: { path: { project_identifier: "some-id-or-name" } },
      })
    );
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
    mockPost.mockResolvedValue({
      data: null,
      error: { detail: JSON.stringify(errorDetail) },
    });

    let thrown: unknown;
    try {
      await logSpans({
        project: { projectName: "my-project" },
        spans: [testSpan, testSpan],
      });
    } catch (e) {
      thrown = e;
    }

    expect(thrown).toBeInstanceOf(SpanCreationError);
    const err = thrown as SpanCreationError;
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
    mockPost.mockResolvedValue({
      data: null,
      error: {
        detail: [
          {
            loc: ["body", "data", 0],
            msg: "field required",
            type: "value_error.missing",
          },
        ],
      },
    });

    let thrown: unknown;
    try {
      await logSpans({
        project: { projectName: "my-project" },
        spans: [testSpan],
      });
    } catch (e) {
      thrown = e;
    }

    expect(thrown).toBeInstanceOf(SpanCreationError);
    const err = thrown as SpanCreationError;
    expect(err.totalReceived).toBe(1);
    expect(err.totalQueued).toBe(0);
    expect(err.invalidSpans).toEqual([
      { spanId: "span-456", traceId: "trace-123", error: "field required" },
    ]);
  });

  it("throws a generic error for unrecognized error shapes", async () => {
    mockPost.mockResolvedValue({
      data: null,
      error: { status: 500, message: "Internal Server Error" },
    });

    await expect(
      logSpans({
        project: { projectName: "my-project" },
        spans: [testSpan],
      })
    ).rejects.toThrow("Failed to log spans:");
  });
});
