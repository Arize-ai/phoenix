import { createHttp } from "@arizeai/phoenix-testing";
import { createMockServer, type Server } from "@arizeai/phoenix-testing/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import type { components } from "../../src/__generated__/api/v1";
import { getSessionTurns } from "../../src/sessions/getSessionTurns";
import { createTestClient } from "../testUtils";

const http = createHttp();

type SessionData = components["schemas"]["SessionData"];
type Span = components["schemas"]["Span"];

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

interface ReceivedSpansQuery {
  cursor: string | null;
  traceIds: string[];
  parentId: string | null;
}

/**
 * Register handlers so the session lookup returns `sessionData` and each
 * subsequent spans request answers with the next page from `spanPages`.
 * Returns captures of every spans request for behavior-level assertions.
 */
function useSessionAndSpansHandlers({
  sessionData,
  spanPages,
}: {
  sessionData: SessionData;
  spanPages: Array<{ spans: Span[]; nextCursor?: string | null }>;
}): { receivedSpansQueries: ReceivedSpansQuery[] } {
  const receivedSpansQueries: ReceivedSpansQuery[] = [];

  server.use(
    http.get("/v1/sessions/{session_identifier}", ({ response }) =>
      response(200).json({ data: sessionData })
    ),
    http.get(
      "/v1/projects/{project_identifier}/spans",
      ({ query, request, response }) => {
        const searchParams = new URL(request.url).searchParams;
        const page = spanPages[receivedSpansQueries.length] ?? { spans: [] };
        receivedSpansQueries.push({
          cursor: searchParams.get("cursor"),
          traceIds: query.getAll("trace_id"),
          parentId: searchParams.get("parent_id"),
        });
        return response(200).json({
          data: page.spans,
          next_cursor: page.nextCursor ?? null,
        });
      }
    )
  );

  return { receivedSpansQueries };
}

describe("getSessionTurns", () => {
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

    useSessionAndSpansHandlers({ sessionData, spanPages: [{ spans: [span] }] });

    const turns = await getSessionTurns({
      client: createTestClient(),
      sessionId: "my-session",
    });

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
    const { receivedSpansQueries } = useSessionAndSpansHandlers({
      sessionData,
      spanPages: [],
    });

    const turns = await getSessionTurns({
      client: createTestClient(),
      sessionId: "my-session",
    });

    expect(turns).toEqual([]);
    // Should only call getSession, not getSpans
    expect(receivedSpansQueries).toHaveLength(0);
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
    useSessionAndSpansHandlers({ sessionData, spanPages: [{ spans: [] }] });

    const turns = await getSessionTurns({
      client: createTestClient(),
      sessionId: "my-session",
    });

    expect(turns).toHaveLength(1);
    expect(turns[0]).toEqual({
      traceId: "trace-1",
      startTime: "2025-01-01T00:00:00.000Z",
      endTime: "2025-01-01T00:01:00.000Z",
    });
    expect(turns[0]?.input).toBeUndefined();
    expect(turns[0]?.output).toBeUndefined();
    expect(turns[0]?.rootSpan).toBeUndefined();
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

    useSessionAndSpansHandlers({ sessionData, spanPages: [{ spans }] });

    const turns = await getSessionTurns({
      client: createTestClient(),
      sessionId: "my-session",
    });

    expect(turns).toHaveLength(3);
    expect(turns[0]?.traceId).toBe("trace-1");
    expect(turns[1]?.traceId).toBe("trace-2");
    expect(turns[2]?.traceId).toBe("trace-3");
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

    useSessionAndSpansHandlers({ sessionData, spanPages: [{ spans: [span] }] });

    const turns = await getSessionTurns({
      client: createTestClient(),
      sessionId: "my-session",
    });

    expect(turns[0]?.input).toEqual({
      value: '{"query": "test"}',
      mimeType: "application/json",
    });
    expect(turns[0]?.output).toEqual({
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
    const { receivedSpansQueries } = useSessionAndSpansHandlers({
      sessionData,
      spanPages: [
        { spans: [span1], nextCursor: "cursor-1" },
        { spans: [span2], nextCursor: null },
      ],
    });

    const turns = await getSessionTurns({
      client: createTestClient(),
      sessionId: "my-session",
    });

    expect(turns).toHaveLength(2);
    // 2 spans requests for the single batch (pagination)
    expect(receivedSpansQueries).toHaveLength(2);
    expect(receivedSpansQueries[0]?.cursor).toBeNull();
    expect(receivedSpansQueries[1]?.cursor).toBe("cursor-1");
  });

  it("should batch trace IDs when there are more than 50 traces", async () => {
    // Create 60 traces
    const traces = Array.from({ length: 60 }, (_unused, index) => ({
      id: `t${index}-global`,
      trace_id: `trace-${index}`,
      start_time: `2025-01-01T00:${String(index).padStart(2, "0")}:00.000Z`,
      end_time: `2025-01-01T00:${String(index).padStart(2, "0")}:30.000Z`,
    }));

    const sessionData = makeSessionData(traces);

    // First batch: 50 traces
    const batch1Spans = Array.from({ length: 50 }, (_unused, index) =>
      makeSpan({ traceId: `trace-${index}` })
    );
    // Second batch: 10 traces
    const batch2Spans = Array.from({ length: 10 }, (_unused, index) =>
      makeSpan({ traceId: `trace-${50 + index}` })
    );

    const { receivedSpansQueries } = useSessionAndSpansHandlers({
      sessionData,
      spanPages: [{ spans: batch1Spans }, { spans: batch2Spans }],
    });

    const turns = await getSessionTurns({
      client: createTestClient(),
      sessionId: "my-session",
    });

    expect(turns).toHaveLength(60);
    // 2 spans requests: one per batch of 50 trace IDs
    expect(receivedSpansQueries).toHaveLength(2);

    // Verify first batch request includes first 50 trace IDs
    expect(receivedSpansQueries[0]?.traceIds).toHaveLength(50);

    // Verify second batch request includes remaining 10 trace IDs
    expect(receivedSpansQueries[1]?.traceIds).toHaveLength(10);
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

    const { receivedSpansQueries } = useSessionAndSpansHandlers({
      sessionData,
      spanPages: [{ spans: [] }],
    });

    await getSessionTurns({
      client: createTestClient(),
      sessionId: "my-session",
    });

    // The spans request should include parent_id: "null"
    expect(receivedSpansQueries[0]?.parentId).toBe("null");
  });
});
