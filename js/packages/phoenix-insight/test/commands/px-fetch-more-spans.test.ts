import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { fetchMoreSpans } from "../../src/commands/px-fetch-more-spans.js";
import type { PhoenixClient } from "@arizeai/phoenix-client";
import type { ExecutionMode } from "../../src/modes/types.js";

describe("fetchMoreSpans", () => {
  let mockClient: {
    GET: Mock;
  };
  let mockMode: {
    writeFile: Mock;
    exec: Mock;
    getBashTool: Mock;
    cleanup: Mock;
  };

  const createMockResponse = (data: any) => ({
    data,
    response: {} as any,
    error: undefined,
  });

  beforeEach(() => {
    mockClient = {
      GET: vi.fn(),
    };
    mockMode = {
      writeFile: vi.fn().mockResolvedValue(undefined),
      exec: vi.fn(),
      getBashTool: vi.fn(),
      cleanup: vi.fn().mockResolvedValue(undefined),
    };
  });

  it("should fetch additional spans and append to existing ones", async () => {
    // Mock existing metadata
    mockMode.exec.mockImplementation((cmd: string) => {
      if (cmd === "cat /phoenix/projects/my-project/spans/metadata.json") {
        return Promise.resolve({
          stdout: JSON.stringify({
            project: "my-project",
            spanCount: 2,
            startTime: null,
            endTime: null,
            snapshotTime: "2025-01-01T10:00:00Z",
            lastCursor: "cursor123",
          }),
          stderr: "",
          exitCode: 0,
        });
      }
      if (cmd === "cat /phoenix/projects/my-project/spans/index.jsonl") {
        return Promise.resolve({
          stdout: `{"id":"span1","name":"Span 1","context":{"trace_id":"t1","span_id":"s1"},"span_kind":"server","parent_id":null,"start_time":"2025-01-01T09:00:00Z","end_time":"2025-01-01T09:00:01Z","status_code":"OK","status_message":"","attributes":{},"events":[]}
{"id":"span2","name":"Span 2","context":{"trace_id":"t1","span_id":"s2"},"span_kind":"internal","parent_id":"s1","start_time":"2025-01-01T09:00:00Z","end_time":"2025-01-01T09:00:01Z","status_code":"OK","status_message":"","attributes":{},"events":[]}`,
          stderr: "",
          exitCode: 0,
        });
      }
      return Promise.resolve({ stdout: "", stderr: "", exitCode: 1 });
    });

    // Mock Phoenix API response
    const newSpans = [
      {
        id: "span3",
        name: "Span 3",
        context: { trace_id: "t2", span_id: "s3" },
        span_kind: "server",
        parent_id: null,
        start_time: "2025-01-01T10:00:00Z",
        end_time: "2025-01-01T10:00:01Z",
        status_code: "OK",
        status_message: "",
        attributes: {},
        events: [],
      },
      {
        id: "span4",
        name: "Span 4",
        context: { trace_id: "t2", span_id: "s4" },
        span_kind: "internal",
        parent_id: "s3",
        start_time: "2025-01-01T10:00:00Z",
        end_time: "2025-01-01T10:00:01Z",
        status_code: "OK",
        status_message: "",
        attributes: {},
        events: [],
      },
    ];

    mockClient.GET.mockResolvedValueOnce(
      createMockResponse({
        data: newSpans,
        next_cursor: null,
      })
    );

    await fetchMoreSpans(
      mockClient as unknown as PhoenixClient,
      mockMode as ExecutionMode,
      {
        project: "my-project",
        limit: 100,
      }
    );

    // Verify API call with the last cursor
    expect(mockClient.GET).toHaveBeenCalledWith(
      "/v1/projects/{project_identifier}/spans",
      {
        params: {
          path: { project_identifier: "my-project" },
          query: { limit: 100, cursor: "cursor123" },
        },
      }
    );

    // Verify spans were written (both existing and new)
    expect(mockMode.writeFile).toHaveBeenCalledWith(
      "/phoenix/projects/my-project/spans/index.jsonl",
      expect.stringContaining("span1")
    );
    expect(mockMode.writeFile).toHaveBeenCalledWith(
      "/phoenix/projects/my-project/spans/index.jsonl",
      expect.stringContaining("span2")
    );
    expect(mockMode.writeFile).toHaveBeenCalledWith(
      "/phoenix/projects/my-project/spans/index.jsonl",
      expect.stringContaining("span3")
    );
    expect(mockMode.writeFile).toHaveBeenCalledWith(
      "/phoenix/projects/my-project/spans/index.jsonl",
      expect.stringContaining("span4")
    );

    // Verify metadata was updated
    expect(mockMode.writeFile).toHaveBeenCalledWith(
      "/phoenix/projects/my-project/spans/metadata.json",
      expect.stringContaining('"spanCount": 4')
    );
    expect(mockMode.writeFile).toHaveBeenCalledWith(
      "/phoenix/projects/my-project/spans/metadata.json",
      expect.stringContaining('"lastCursor": null')
    );
  });

  it("should fetch spans when no existing data exists", async () => {
    // Mock no existing metadata or spans
    mockMode.exec.mockResolvedValue({
      stdout: "",
      stderr:
        "cat: /phoenix/projects/new-project/spans/metadata.json: No such file or directory",
      exitCode: 1,
    });

    const spans = [
      {
        id: "span1",
        name: "New Span 1",
        context: { trace_id: "t1", span_id: "s1" },
        span_kind: "server",
        parent_id: null,
        start_time: "2025-01-01T11:00:00Z",
        end_time: "2025-01-01T11:00:01Z",
        status_code: "OK",
        status_message: "",
        attributes: {},
        events: [],
      },
    ];

    mockClient.GET.mockResolvedValueOnce(
      createMockResponse({
        data: spans,
        next_cursor: null, // No more data
      })
    );

    await fetchMoreSpans(
      mockClient as unknown as PhoenixClient,
      mockMode as ExecutionMode,
      {
        project: "new-project",
        limit: 50,
      }
    );

    // Verify API call without cursor
    expect(mockClient.GET).toHaveBeenCalledWith(
      "/v1/projects/{project_identifier}/spans",
      {
        params: {
          path: { project_identifier: "new-project" },
          query: { limit: 50 },
        },
      }
    );

    // Verify spans were written
    expect(mockMode.writeFile).toHaveBeenCalledWith(
      "/phoenix/projects/new-project/spans/index.jsonl",
      JSON.stringify(spans[0])
    );

    // Verify metadata was created
    expect(mockMode.writeFile).toHaveBeenCalledWith(
      "/phoenix/projects/new-project/spans/metadata.json",
      expect.stringContaining('"spanCount": 1')
    );
    expect(mockMode.writeFile).toHaveBeenCalledWith(
      "/phoenix/projects/new-project/spans/metadata.json",
      expect.stringContaining('"lastCursor": null')
    );
  });

  it("should respect time filters", async () => {
    mockMode.exec.mockResolvedValue({
      stdout: "",
      stderr: "",
      exitCode: 1,
    });

    mockClient.GET.mockResolvedValueOnce(
      createMockResponse({
        data: [],
        next_cursor: null,
      })
    );

    const startTime = new Date("2025-01-01T12:00:00Z");
    const endTime = "2025-01-01T13:00:00Z";

    await fetchMoreSpans(
      mockClient as unknown as PhoenixClient,
      mockMode as ExecutionMode,
      {
        project: "time-filtered",
        limit: 20,
        startTime,
        endTime,
      }
    );

    // Verify API call includes time filters
    expect(mockClient.GET).toHaveBeenCalledWith(
      "/v1/projects/{project_identifier}/spans",
      {
        params: {
          path: { project_identifier: "time-filtered" },
          query: {
            limit: 20,
            start_time: "2025-01-01T12:00:00.000Z",
            end_time: "2025-01-01T13:00:00Z",
          },
        },
      }
    );

    // Verify metadata includes time filters
    expect(mockMode.writeFile).toHaveBeenCalledWith(
      "/phoenix/projects/time-filtered/spans/metadata.json",
      expect.stringContaining('"startTime": "2025-01-01T12:00:00.000Z"')
    );
    expect(mockMode.writeFile).toHaveBeenCalledWith(
      "/phoenix/projects/time-filtered/spans/metadata.json",
      expect.stringContaining('"endTime": "2025-01-01T13:00:00Z"')
    );
  });

  it("should handle pagination correctly", async () => {
    mockMode.exec.mockResolvedValue({
      stdout: "",
      stderr: "",
      exitCode: 1,
    });

    // First page
    mockClient.GET.mockResolvedValueOnce(
      createMockResponse({
        data: Array(100)
          .fill(null)
          .map((_, i) => ({
            id: `span${i}`,
            name: `Span ${i}`,
            context: { trace_id: "t1", span_id: `s${i}` },
            span_kind: "server",
            parent_id: null,
            start_time: "2025-01-01T14:00:00Z",
            end_time: "2025-01-01T14:00:01Z",
            status_code: "OK",
            status_message: "",
            attributes: {},
            events: [],
          })),
        next_cursor: "page2",
      })
    );

    // Second page
    mockClient.GET.mockResolvedValueOnce(
      createMockResponse({
        data: Array(50)
          .fill(null)
          .map((_, i) => ({
            id: `span${100 + i}`,
            name: `Span ${100 + i}`,
            context: { trace_id: "t1", span_id: `s${100 + i}` },
            span_kind: "server",
            parent_id: null,
            start_time: "2025-01-01T14:00:00Z",
            end_time: "2025-01-01T14:00:01Z",
            status_code: "OK",
            status_message: "",
            attributes: {},
            events: [],
          })),
        next_cursor: "page3",
      })
    );

    await fetchMoreSpans(
      mockClient as unknown as PhoenixClient,
      mockMode as ExecutionMode,
      {
        project: "paginated-project",
        limit: 150,
      }
    );

    // Verify two API calls were made
    expect(mockClient.GET).toHaveBeenCalledTimes(2);

    // First call
    expect(mockClient.GET).toHaveBeenNthCalledWith(
      1,
      "/v1/projects/{project_identifier}/spans",
      {
        params: {
          path: { project_identifier: "paginated-project" },
          query: { limit: 100 },
        },
      }
    );

    // Second call with cursor and adjusted limit
    expect(mockClient.GET).toHaveBeenNthCalledWith(
      2,
      "/v1/projects/{project_identifier}/spans",
      {
        params: {
          path: { project_identifier: "paginated-project" },
          query: { limit: 50, cursor: "page2" },
        },
      }
    );

    // Verify total span count
    expect(mockMode.writeFile).toHaveBeenCalledWith(
      "/phoenix/projects/paginated-project/spans/metadata.json",
      expect.stringContaining('"spanCount": 150')
    );
  });

  it("should handle API errors gracefully", async () => {
    mockMode.exec.mockResolvedValue({
      stdout: "",
      stderr: "",
      exitCode: 1,
    });

    mockClient.GET.mockRejectedValueOnce(
      new Error("localhost:6006: 500 Internal Server Error")
    );

    await expect(
      fetchMoreSpans(
        mockClient as unknown as PhoenixClient,
        mockMode as ExecutionMode,
        {
          project: "error-project",
          limit: 10,
        }
      )
    ).rejects.toThrow(
      "Server error during fetching more spans for project error-project: 500 Internal Server Error"
    );
  });

  it("should handle empty response correctly", async () => {
    mockMode.exec.mockResolvedValue({
      stdout: "",
      stderr: "",
      exitCode: 1,
    });

    mockClient.GET.mockResolvedValueOnce(
      createMockResponse({
        data: [],
        next_cursor: null,
      })
    );

    await fetchMoreSpans(
      mockClient as unknown as PhoenixClient,
      mockMode as ExecutionMode,
      {
        project: "empty-project",
        limit: 100,
      }
    );

    // Verify empty JSONL file was written
    expect(mockMode.writeFile).toHaveBeenCalledWith(
      "/phoenix/projects/empty-project/spans/index.jsonl",
      ""
    );

    // Verify metadata shows 0 spans
    expect(mockMode.writeFile).toHaveBeenCalledWith(
      "/phoenix/projects/empty-project/spans/metadata.json",
      expect.stringContaining('"spanCount": 0')
    );
  });
});
