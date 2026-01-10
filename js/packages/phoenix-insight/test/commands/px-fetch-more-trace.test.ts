import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchMoreTrace } from "../../src/commands/px-fetch-more-trace.js";
import type { ExecutionMode } from "../../src/modes/types.js";

// Mock the Phoenix client
vi.mock("@arizeai/phoenix-client", () => ({
  PhoenixClient: vi.fn(),
}));

describe("fetchMoreTrace", () => {
  let mockClient: any;
  let mockMode: ExecutionMode;

  beforeEach(() => {
    // Create a simple mock client
    mockClient = {
      GET: vi.fn(),
    };

    mockMode = {
      writeFile: vi.fn().mockResolvedValue(undefined),
      exec: vi.fn().mockResolvedValue({
        exitCode: 0,
        stdout: "",
        stderr: "",
      }),
      getBashTool: vi.fn(),
      cleanup: vi.fn(),
    };

    vi.clearAllMocks();
  });

  it("should fetch all spans for a specific trace", async () => {
    // Mock project list
    vi.mocked(mockMode.exec).mockResolvedValueOnce({
      exitCode: 0,
      stdout: `{"name":"test-project","id":"proj1"}
{"name":"another-project","id":"proj2"}`,
      stderr: "",
    });

    // Mock spans response with mixed traces
    const mockSpans = [
      {
        id: "span1",
        name: "Root Span",
        context: { trace_id: "trace123", span_id: "s1" },
        span_kind: "server",
        parent_id: null,
        start_time: "2025-01-10T10:00:00Z",
        end_time: "2025-01-10T10:00:05Z",
        status_code: "OK",
        status_message: "",
        attributes: { service: "api" },
        events: [],
      },
      {
        id: "span2",
        name: "Child Span",
        context: { trace_id: "trace123", span_id: "s2" },
        span_kind: "internal",
        parent_id: "span1",
        start_time: "2025-01-10T10:00:01Z",
        end_time: "2025-01-10T10:00:04Z",
        status_code: "OK",
        status_message: "",
        attributes: { operation: "db_query" },
        events: [],
      },
      {
        id: "span3",
        name: "Other Trace Span",
        context: { trace_id: "other-trace", span_id: "s3" },
        span_kind: "server",
        parent_id: null,
        start_time: "2025-01-10T10:00:00Z",
        end_time: "2025-01-10T10:00:02Z",
        status_code: "OK",
        status_message: "",
        attributes: {},
        events: [],
      },
    ];

    mockClient.GET.mockResolvedValueOnce({
      data: { data: mockSpans, next_cursor: null },
      error: null,
      response: {},
    });

    await fetchMoreTrace(mockClient, mockMode, {
      traceId: "trace123",
      project: "test-project",
    });

    // Verify API was called correctly
    expect(mockClient.GET).toHaveBeenCalledWith(
      "/v1/projects/{project_identifier}/spans",
      {
        params: {
          path: { project_identifier: "test-project" },
          query: { limit: 100 },
        },
      }
    );

    // Verify only trace123 spans were written
    const writeFileCalls = vi.mocked(mockMode.writeFile).mock.calls;
    expect(writeFileCalls).toHaveLength(2);

    // Check spans file
    expect(writeFileCalls[0][0]).toBe("/phoenix/traces/trace123/spans.jsonl");
    const spansContent = writeFileCalls[0][1];
    const writtenSpans = spansContent
      .split("\n")
      .map((line: string) => JSON.parse(line));
    expect(writtenSpans).toHaveLength(2);
    expect(writtenSpans[0].context.trace_id).toBe("trace123");
    expect(writtenSpans[1].context.trace_id).toBe("trace123");

    // Check metadata file
    expect(writeFileCalls[1][0]).toBe("/phoenix/traces/trace123/metadata.json");
    const metadata = JSON.parse(writeFileCalls[1][1]);
    expect(metadata.traceId).toBe("trace123");
    expect(metadata.project).toBe("test-project");
    expect(metadata.spanCount).toBe(2);
    expect(metadata.rootSpan).toEqual({ id: "span1", name: "Root Span" });
    expect(metadata.duration).toBe(4000); // 4 seconds (child span ends at 10:00:04, root starts at 10:00:00)
  });

  it("should handle pagination when searching for trace", async () => {
    // Mock project list
    vi.mocked(mockMode.exec).mockResolvedValueOnce({
      exitCode: 0,
      stdout: `{"name":"test-project","id":"proj1"}`,
      stderr: "",
    });

    // First page - no matching trace
    mockClient.GET.mockResolvedValueOnce({
      data: {
        data: Array(100)
          .fill(null)
          .map((_, i) => ({
            id: `span${i}`,
            name: `Span ${i}`,
            context: { trace_id: `other-trace-${i}`, span_id: `s${i}` },
            span_kind: "internal",
            parent_id: null,
            start_time: "2025-01-10T10:00:00Z",
            end_time: "2025-01-10T10:00:01Z",
            status_code: "OK",
            status_message: "",
            attributes: {},
            events: [],
          })),
        next_cursor: "cursor1",
      },
      error: null,
      response: {},
    });

    // Second page - found our trace
    mockClient.GET.mockResolvedValueOnce({
      data: {
        data: [
          {
            id: "target-span",
            name: "Target Span",
            context: { trace_id: "trace123", span_id: "ts1" },
            span_kind: "server",
            parent_id: null,
            start_time: "2025-01-10T11:00:00Z",
            end_time: "2025-01-10T11:00:03Z",
            status_code: "OK",
            status_message: "",
            attributes: {},
            events: [],
          },
        ],
        next_cursor: null,
      },
      error: null,
      response: {},
    });

    await fetchMoreTrace(mockClient, mockMode, {
      traceId: "trace123",
      project: "test-project",
    });

    // Verify pagination was used
    expect(mockClient.GET).toHaveBeenCalledTimes(2);
    expect(mockClient.GET.mock.calls[1][1].params.query.cursor).toBe("cursor1");

    // Verify trace was found and written
    expect(mockMode.writeFile).toHaveBeenCalledWith(
      "/phoenix/traces/trace123/spans.jsonl",
      expect.any(String)
    );
  });

  it("should handle trace not found", async () => {
    // Mock project list
    vi.mocked(mockMode.exec).mockResolvedValueOnce({
      exitCode: 0,
      stdout: `{"name":"test-project","id":"proj1"}`,
      stderr: "",
    });

    // Mock empty response
    mockClient.GET.mockResolvedValueOnce({
      data: { data: [], next_cursor: null },
      error: null,
      response: {},
    });

    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await fetchMoreTrace(mockClient, mockMode, {
      traceId: "nonexistent-trace",
      project: "test-project",
    });

    expect(consoleSpy).toHaveBeenCalledWith(
      'No spans found for trace nonexistent-trace in project "test-project"'
    );
    expect(mockMode.writeFile).not.toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  it("should handle project not found", async () => {
    // Mock project list without our project
    vi.mocked(mockMode.exec).mockResolvedValueOnce({
      exitCode: 0,
      stdout: `{"name":"other-project","id":"proj1"}`,
      stderr: "",
    });

    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    await fetchMoreTrace(mockClient, mockMode, {
      traceId: "trace123",
      project: "nonexistent-project",
    });

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Project "nonexistent-project" not found. Available projects: other-project'
    );
    expect(mockClient.GET).not.toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });

  it("should handle no projects in snapshot", async () => {
    // Mock empty project list
    vi.mocked(mockMode.exec).mockResolvedValueOnce({
      exitCode: 1,
      stdout: "",
      stderr: "cat: /phoenix/projects/index.jsonl: No such file or directory",
    });

    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    await fetchMoreTrace(mockClient, mockMode, {
      traceId: "trace123",
      project: "test-project",
    });

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "No projects found in snapshot. Run a snapshot first."
    );
    expect(mockClient.GET).not.toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });

  it("should continue fetching if trace spans are spread across pages", async () => {
    // Mock project list
    vi.mocked(mockMode.exec).mockResolvedValueOnce({
      exitCode: 0,
      stdout: `{"name":"test-project","id":"proj1"}`,
      stderr: "",
    });

    // First page - found one span of the trace
    mockClient.GET.mockResolvedValueOnce({
      data: {
        data: [
          {
            id: "span1",
            name: "First Span",
            context: { trace_id: "trace123", span_id: "s1" },
            span_kind: "server",
            parent_id: null,
            start_time: "2025-01-10T10:00:00Z",
            end_time: "2025-01-10T10:00:05Z",
            status_code: "OK",
            status_message: "",
            attributes: {},
            events: [],
          },
          ...Array(99)
            .fill(null)
            .map((_, i) => ({
              id: `other${i}`,
              name: `Other ${i}`,
              context: { trace_id: `other-${i}`, span_id: `o${i}` },
              span_kind: "internal",
              parent_id: null,
              start_time: "2025-01-10T10:00:00Z",
              end_time: "2025-01-10T10:00:01Z",
              status_code: "OK",
              status_message: "",
              attributes: {},
              events: [],
            })),
        ],
        next_cursor: "cursor1",
      },
      error: null,
      response: {},
    });

    // Second page - found another span of the same trace
    mockClient.GET.mockResolvedValueOnce({
      data: {
        data: [
          {
            id: "span2",
            name: "Second Span",
            context: { trace_id: "trace123", span_id: "s2" },
            span_kind: "internal",
            parent_id: "span1",
            start_time: "2025-01-10T10:00:01Z",
            end_time: "2025-01-10T10:00:04Z",
            status_code: "OK",
            status_message: "",
            attributes: {},
            events: [],
          },
        ],
        next_cursor: null,
      },
      error: null,
      response: {},
    });

    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await fetchMoreTrace(mockClient, mockMode, {
      traceId: "trace123",
      project: "test-project",
    });

    // Verify both pages were fetched
    expect(mockClient.GET).toHaveBeenCalledTimes(2);

    // Verify all spans were collected
    const writeFileCalls = vi.mocked(mockMode.writeFile).mock.calls;
    const spansContent = writeFileCalls[0][1];
    const writtenSpans = spansContent
      .split("\n")
      .map((line: string) => JSON.parse(line));
    expect(writtenSpans).toHaveLength(2);
    expect(writtenSpans[0].id).toBe("span1");
    expect(writtenSpans[1].id).toBe("span2");

    consoleSpy.mockRestore();
  });

  it("should handle API errors gracefully", async () => {
    // Mock project list
    vi.mocked(mockMode.exec).mockResolvedValueOnce({
      exitCode: 0,
      stdout: `{"name":"test-project","id":"proj1"}`,
      stderr: "",
    });

    // Mock API error
    mockClient.GET.mockResolvedValueOnce({
      data: null,
      error: { detail: "Internal server error" },
      response: {},
    });

    await expect(
      fetchMoreTrace(mockClient, mockMode, {
        traceId: "trace123",
        project: "test-project",
      })
    ).rejects.toThrow("Unexpected error during fetching trace trace123");
  });
});
