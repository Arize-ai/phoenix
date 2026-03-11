import { beforeEach, describe, expect, it, vi } from "vitest";

import type { components } from "../../src/__generated__/api/v1";
import { getSessionTurns } from "../../src/sessions/getSessionTurns";

const mockGet = vi.fn();

vi.mock("openapi-fetch", () => ({
  default: () => ({
    GET: mockGet,
    use: () => {},
  }),
}));

type SessionData = components["schemas"]["SessionData"];
type Span = components["schemas"]["Span"];

function makeSpan(overrides: {
  traceId: string;
  startTime?: string;
  endTime?: string;
  attributes?: Record<string, unknown>;
}): Span {
  return {
    name: "root",
    context: {
      trace_id: overrides.traceId,
      span_id: `span-${overrides.traceId}`,
    },
    span_kind: "CHAIN",
    start_time: overrides.startTime ?? "2025-01-01T00:00:00.000Z",
    end_time: overrides.endTime ?? "2025-01-01T00:01:00.000Z",
    status_code: "OK",
    attributes: overrides.attributes ?? {},
  };
}

function makeSessionData(traces: SessionData["traces"]): SessionData {
  return {
    id: "session-global-id",
    session_id: "my-session",
    project_id: "project-1",
    start_time: "2025-01-01T00:00:00.000Z",
    end_time: "2025-01-01T01:00:00.000Z",
    traces,
  };
}

/** Helper to set up mockGet responses: first call returns session, subsequent calls return spans */
function mockSessionAndSpans(
  sessionData: SessionData,
  spanResponses: Array<{ spans: Span[]; nextCursor?: string | null }>
) {
  // First call: getSession
  mockGet.mockResolvedValueOnce({ data: { data: sessionData } });
  // Subsequent calls: getSpans
  for (const resp of spanResponses) {
    mockGet.mockResolvedValueOnce({
      data: {
        data: resp.spans,
        next_cursor: resp.nextCursor ?? null,
      },
    });
  }
}

describe("getSessionTurns", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGet.mockReset();
  });

  it("should return session turns with input/output", async () => {
    const sessionData = makeSessionData([
      {
        id: "t1-global",
        trace_id: "trace-1",
        start_time: "2025-01-01T00:00:00.000Z",
        end_time: "2025-01-01T00:01:00.000Z",
      },
    ]);

    const span = makeSpan({
      traceId: "trace-1",
      attributes: {
        "input.value": "Hello",
        "output.value": "Hi there!",
      },
    });

    mockSessionAndSpans(sessionData, [{ spans: [span] }]);

    const turns = await getSessionTurns({ sessionId: "my-session" });

    expect(turns).toHaveLength(1);
    expect(turns[0]).toEqual({
      traceId: "trace-1",
      startTime: "2025-01-01T00:00:00.000Z",
      endTime: "2025-01-01T00:01:00.000Z",
      input: { value: "Hello" },
      output: { value: "Hi there!" },
      rootSpan: span,
    });
  });

  it("should return empty array for session with no traces", async () => {
    const sessionData = makeSessionData([]);
    mockGet.mockResolvedValueOnce({ data: { data: sessionData } });

    const turns = await getSessionTurns({ sessionId: "my-session" });
    expect(turns).toEqual([]);
    // Should only call getSession, not getSpans
    expect(mockGet).toHaveBeenCalledTimes(1);
  });

  it("should return turn without input/output when root span is missing", async () => {
    const sessionData = makeSessionData([
      {
        id: "t1-global",
        trace_id: "trace-1",
        start_time: "2025-01-01T00:00:00.000Z",
        end_time: "2025-01-01T00:01:00.000Z",
      },
    ]);

    // Return no spans
    mockSessionAndSpans(sessionData, [{ spans: [] }]);

    const turns = await getSessionTurns({ sessionId: "my-session" });

    expect(turns).toHaveLength(1);
    expect(turns[0]).toEqual({
      traceId: "trace-1",
      startTime: "2025-01-01T00:00:00.000Z",
      endTime: "2025-01-01T00:01:00.000Z",
    });
    expect(turns[0].input).toBeUndefined();
    expect(turns[0].output).toBeUndefined();
    expect(turns[0].rootSpan).toBeUndefined();
  });

  it("should sort turns by startTime ascending", async () => {
    const sessionData = makeSessionData([
      {
        id: "t2-global",
        trace_id: "trace-2",
        start_time: "2025-01-01T00:05:00.000Z",
        end_time: "2025-01-01T00:06:00.000Z",
      },
      {
        id: "t1-global",
        trace_id: "trace-1",
        start_time: "2025-01-01T00:00:00.000Z",
        end_time: "2025-01-01T00:01:00.000Z",
      },
      {
        id: "t3-global",
        trace_id: "trace-3",
        start_time: "2025-01-01T00:10:00.000Z",
        end_time: "2025-01-01T00:11:00.000Z",
      },
    ]);

    const spans = [
      makeSpan({
        traceId: "trace-2",
        attributes: { "input.value": "Second" },
      }),
      makeSpan({
        traceId: "trace-1",
        attributes: { "input.value": "First" },
      }),
      makeSpan({
        traceId: "trace-3",
        attributes: { "input.value": "Third" },
      }),
    ];

    mockSessionAndSpans(sessionData, [{ spans }]);

    const turns = await getSessionTurns({ sessionId: "my-session" });

    expect(turns).toHaveLength(3);
    expect(turns[0].traceId).toBe("trace-1");
    expect(turns[1].traceId).toBe("trace-2");
    expect(turns[2].traceId).toBe("trace-3");
  });

  it("should handle mime_type in input and output", async () => {
    const sessionData = makeSessionData([
      {
        id: "t1-global",
        trace_id: "trace-1",
        start_time: "2025-01-01T00:00:00.000Z",
        end_time: "2025-01-01T00:01:00.000Z",
      },
    ]);

    const span = makeSpan({
      traceId: "trace-1",
      attributes: {
        "input.value": '{"query": "test"}',
        "input.mime_type": "application/json",
        "output.value": "Response text",
        "output.mime_type": "text/plain",
      },
    });

    mockSessionAndSpans(sessionData, [{ spans: [span] }]);

    const turns = await getSessionTurns({ sessionId: "my-session" });

    expect(turns[0].input).toEqual({
      value: '{"query": "test"}',
      mimeType: "application/json",
    });
    expect(turns[0].output).toEqual({
      value: "Response text",
      mimeType: "text/plain",
    });
  });

  it("should handle pagination within a batch", async () => {
    const sessionData = makeSessionData([
      {
        id: "t1-global",
        trace_id: "trace-1",
        start_time: "2025-01-01T00:00:00.000Z",
        end_time: "2025-01-01T00:01:00.000Z",
      },
      {
        id: "t2-global",
        trace_id: "trace-2",
        start_time: "2025-01-01T00:05:00.000Z",
        end_time: "2025-01-01T00:06:00.000Z",
      },
    ]);

    const span1 = makeSpan({
      traceId: "trace-1",
      attributes: { "input.value": "First" },
    });
    const span2 = makeSpan({
      traceId: "trace-2",
      attributes: { "input.value": "Second" },
    });

    // First page returns span1 with a cursor, second page returns span2
    mockSessionAndSpans(sessionData, [
      { spans: [span1], nextCursor: "cursor-1" },
      { spans: [span2], nextCursor: null },
    ]);

    const turns = await getSessionTurns({ sessionId: "my-session" });

    expect(turns).toHaveLength(2);
    // 3 calls total: 1 getSession + 2 getSpans (pagination)
    expect(mockGet).toHaveBeenCalledTimes(3);
  });

  it("should batch trace IDs when there are more than 50 traces", async () => {
    // Create 60 traces
    const traces = Array.from({ length: 60 }, (_, i) => ({
      id: `t${i}-global`,
      trace_id: `trace-${i}`,
      start_time: `2025-01-01T00:${String(i).padStart(2, "0")}:00.000Z`,
      end_time: `2025-01-01T00:${String(i).padStart(2, "0")}:30.000Z`,
    }));

    const sessionData = makeSessionData(traces);

    // First batch: 50 traces
    const batch1Spans = Array.from({ length: 50 }, (_, i) =>
      makeSpan({ traceId: `trace-${i}` })
    );
    // Second batch: 10 traces
    const batch2Spans = Array.from({ length: 10 }, (_, i) =>
      makeSpan({ traceId: `trace-${50 + i}` })
    );

    mockSessionAndSpans(sessionData, [
      { spans: batch1Spans },
      { spans: batch2Spans },
    ]);

    const turns = await getSessionTurns({ sessionId: "my-session" });

    expect(turns).toHaveLength(60);
    // 3 calls: 1 getSession + 2 getSpans (2 batches)
    expect(mockGet).toHaveBeenCalledTimes(3);

    // Verify first batch request includes first 50 trace IDs
    const firstSpansCall = mockGet.mock.calls[1];
    expect(firstSpansCall[0]).toBe("/v1/projects/{project_identifier}/spans");
    const firstQueryTraceIds = firstSpansCall[1].params.query.trace_id;
    expect(firstQueryTraceIds).toHaveLength(50);

    // Verify second batch request includes remaining 10 trace IDs
    const secondSpansCall = mockGet.mock.calls[2];
    const secondQueryTraceIds = secondSpansCall[1].params.query.trace_id;
    expect(secondQueryTraceIds).toHaveLength(10);
  });

  it("should pass parentId as null string to get root spans only", async () => {
    const sessionData = makeSessionData([
      {
        id: "t1-global",
        trace_id: "trace-1",
        start_time: "2025-01-01T00:00:00.000Z",
        end_time: "2025-01-01T00:01:00.000Z",
      },
    ]);

    mockSessionAndSpans(sessionData, [{ spans: [] }]);

    await getSessionTurns({ sessionId: "my-session" });

    // The spans call should include parent_id: "null"
    const spansCall = mockGet.mock.calls[1];
    expect(spansCall[1].params.query.parent_id).toBe("null");
  });
});
