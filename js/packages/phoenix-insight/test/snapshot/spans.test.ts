import { describe, it, expect, vi, beforeEach } from "vitest";
import { snapshotSpans } from "../../src/snapshot/spans.js";
import type { PhoenixClient } from "@arizeai/phoenix-client";
import type { ExecutionMode } from "../../src/modes/types.js";

describe("snapshotSpans", () => {
  let mockMode: ExecutionMode;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock execution mode
    mockMode = {
      writeFile: vi.fn().mockResolvedValue(undefined),
      exec: vi.fn(),
      getBashTool: vi.fn(),
      cleanup: vi.fn(),
    };
  });

  // Helper to create mock client with specific responses
  const createMockClient = (responses: Array<{ data: any; error?: any }>) => {
    let callIndex = 0;
    const mockClient = {
      GET: vi.fn(async () => {
        const response = responses[callIndex];
        callIndex++;
        if (response.error) {
          return {
            data: undefined,
            response: {} as any,
            error: response.error,
          };
        }
        return {
          data: response.data,
          response: {} as any,
          error: undefined,
        };
      }),
    } as unknown as PhoenixClient;
    return mockClient;
  };

  it("should fetch and save spans for all projects", async () => {
    // Mock projects index
    const projects = [
      { name: "project1", id: "proj-1" },
      { name: "project2", id: "proj-2" },
    ];

    vi.mocked(mockMode.exec).mockResolvedValueOnce({
      stdout: projects.map((p) => JSON.stringify(p)).join("\n"),
      stderr: "",
      exitCode: 0,
    });

    // Mock spans data
    const project1Spans = [
      {
        id: "span1",
        name: "operation1",
        context: { trace_id: "trace1", span_id: "span1" },
        span_kind: "SERVER",
        parent_id: null,
        start_time: "2024-01-01T00:00:00Z",
        end_time: "2024-01-01T00:00:01Z",
        status_code: "OK",
        status_message: "",
        attributes: { "http.method": "GET" },
        events: [],
      },
      {
        id: "span2",
        name: "operation2",
        context: { trace_id: "trace1", span_id: "span2" },
        span_kind: "CLIENT",
        parent_id: "span1",
        start_time: "2024-01-01T00:00:00.5Z",
        end_time: "2024-01-01T00:00:00.8Z",
        status_code: "OK",
        status_message: "",
        attributes: { "db.name": "mydb" },
        events: [],
      },
    ];

    const project2Spans = [
      {
        id: "span3",
        name: "operation3",
        context: { trace_id: "trace2", span_id: "span3" },
        span_kind: "INTERNAL",
        parent_id: null,
        start_time: "2024-01-01T00:01:00Z",
        end_time: "2024-01-01T00:01:02Z",
        status_code: "ERROR",
        status_message: "Internal error",
        attributes: { error: true },
        events: [],
      },
    ];

    // Mock API responses
    const mockClient = createMockClient([
      { data: { data: project1Spans, next_cursor: null } },
      { data: { data: project2Spans, next_cursor: null } },
    ]);

    await snapshotSpans(mockClient, mockMode);

    // Verify API calls
    expect(mockClient.GET).toHaveBeenCalledTimes(2);
    expect(mockClient.GET).toHaveBeenCalledWith(
      "/v1/projects/{project_identifier}/spans",
      {
        params: {
          path: { project_identifier: "project1" },
          query: { limit: 100 },
        },
      }
    );
    expect(mockClient.GET).toHaveBeenCalledWith(
      "/v1/projects/{project_identifier}/spans",
      {
        params: {
          path: { project_identifier: "project2" },
          query: { limit: 100 },
        },
      }
    );

    // Verify files were written
    expect(mockMode.writeFile).toHaveBeenCalledTimes(4); // 2 projects x (spans + metadata)

    // Check project1 spans
    expect(mockMode.writeFile).toHaveBeenCalledWith(
      "/phoenix/projects/project1/spans/index.jsonl",
      project1Spans.map((s) => JSON.stringify(s)).join("\n")
    );

    // Check project2 spans
    expect(mockMode.writeFile).toHaveBeenCalledWith(
      "/phoenix/projects/project2/spans/index.jsonl",
      project2Spans.map((s) => JSON.stringify(s)).join("\n")
    );

    // Check metadata files
    const writeFileCalls = vi.mocked(mockMode.writeFile).mock.calls;
    const project1MetadataCall = writeFileCalls.find(
      (call) => call[0] === "/phoenix/projects/project1/spans/metadata.json"
    );
    expect(project1MetadataCall).toBeDefined();
    const project1Metadata = JSON.parse(project1MetadataCall![1]);
    expect(project1Metadata).toMatchObject({
      project: "project1",
      spanCount: 2,
      startTime: null,
      endTime: null,
    });

    const project2MetadataCall = writeFileCalls.find(
      (call) => call[0] === "/phoenix/projects/project2/spans/metadata.json"
    );
    expect(project2MetadataCall).toBeDefined();
    const project2Metadata = JSON.parse(project2MetadataCall![1]);
    expect(project2Metadata).toMatchObject({
      project: "project2",
      spanCount: 1,
      startTime: null,
      endTime: null,
    });
  });

  it("should handle pagination when fetching spans", async () => {
    const projects = [{ name: "project1", id: "proj-1" }];

    vi.mocked(mockMode.exec).mockResolvedValueOnce({
      stdout: projects.map((p) => JSON.stringify(p)).join("\n"),
      stderr: "",
      exitCode: 0,
    });

    // Create 150 spans to test pagination
    const batch1 = Array.from({ length: 100 }, (_, i) => ({
      id: `span${i}`,
      name: `operation${i}`,
      context: { trace_id: "trace1", span_id: `span${i}` },
      span_kind: "SERVER",
      parent_id: null,
      start_time: "2024-01-01T00:00:00Z",
      end_time: "2024-01-01T00:00:01Z",
      status_code: "OK",
      status_message: "",
      attributes: {},
      events: [],
    }));

    const batch2 = Array.from({ length: 50 }, (_, i) => ({
      id: `span${i + 100}`,
      name: `operation${i + 100}`,
      context: { trace_id: "trace1", span_id: `span${i + 100}` },
      span_kind: "SERVER",
      parent_id: null,
      start_time: "2024-01-01T00:00:00Z",
      end_time: "2024-01-01T00:00:01Z",
      status_code: "OK",
      status_message: "",
      attributes: {},
      events: [],
    }));

    const mockClient = createMockClient([
      { data: { data: batch1, next_cursor: "cursor-100" } },
      { data: { data: batch2, next_cursor: null } },
    ]);

    await snapshotSpans(mockClient, mockMode, { spansPerProject: 150 });

    expect(mockClient.GET).toHaveBeenCalledTimes(2);

    // First call should not have cursor
    expect(mockClient.GET).toHaveBeenNthCalledWith(
      1,
      "/v1/projects/{project_identifier}/spans",
      {
        params: {
          path: { project_identifier: "project1" },
          query: { limit: 100 },
        },
      }
    );

    // Second call should include cursor
    expect(mockClient.GET).toHaveBeenNthCalledWith(
      2,
      "/v1/projects/{project_identifier}/spans",
      {
        params: {
          path: { project_identifier: "project1" },
          query: { limit: 50, cursor: "cursor-100" },
        },
      }
    );

    // Verify all 150 spans were written
    const expectedJSONL = [...batch1, ...batch2]
      .map((s) => JSON.stringify(s))
      .join("\n");
    expect(mockMode.writeFile).toHaveBeenCalledWith(
      "/phoenix/projects/project1/spans/index.jsonl",
      expectedJSONL
    );
  });

  it("should apply time filters when provided", async () => {
    const projects = [{ name: "project1", id: "proj-1" }];

    vi.mocked(mockMode.exec).mockResolvedValueOnce({
      stdout: projects.map((p) => JSON.stringify(p)).join("\n"),
      stderr: "",
      exitCode: 0,
    });

    const mockClient = createMockClient([
      { data: { data: [], next_cursor: null } },
    ]);

    const startTime = new Date("2024-01-01T00:00:00Z");
    const endTime = "2024-01-02T00:00:00Z";

    await snapshotSpans(mockClient, mockMode, { startTime, endTime });

    expect(mockClient.GET).toHaveBeenCalledWith(
      "/v1/projects/{project_identifier}/spans",
      {
        params: {
          path: { project_identifier: "project1" },
          query: {
            limit: 100,
            start_time: "2024-01-01T00:00:00.000Z",
            end_time: "2024-01-02T00:00:00Z",
          },
        },
      }
    );
  });

  it("should respect spansPerProject limit", async () => {
    const projects = [{ name: "project1", id: "proj-1" }];

    vi.mocked(mockMode.exec).mockResolvedValueOnce({
      stdout: projects.map((p) => JSON.stringify(p)).join("\n"),
      stderr: "",
      exitCode: 0,
    });

    const manySpans = Array.from({ length: 100 }, (_, i) => ({
      id: `span${i}`,
      name: `operation${i}`,
      context: { trace_id: "trace1", span_id: `span${i}` },
      span_kind: "SERVER",
      parent_id: null,
      start_time: "2024-01-01T00:00:00Z",
      end_time: "2024-01-01T00:00:01Z",
      status_code: "OK",
      status_message: "",
      attributes: {},
      events: [],
    }));

    // Return 100 spans but we only want 50
    const mockClient = createMockClient([
      { data: { data: manySpans.slice(0, 50), next_cursor: "cursor-50" } },
    ]);

    await snapshotSpans(mockClient, mockMode, { spansPerProject: 50 });

    // Should only make one API call since we got our limit
    expect(mockClient.GET).toHaveBeenCalledTimes(1);
    expect(mockClient.GET).toHaveBeenCalledWith(
      "/v1/projects/{project_identifier}/spans",
      {
        params: {
          path: { project_identifier: "project1" },
          query: { limit: 50 },
        },
      }
    );

    // Should only write 50 spans
    const writtenSpans = vi
      .mocked(mockMode.writeFile)
      .mock.calls.find(
        (call) => call[0] === "/phoenix/projects/project1/spans/index.jsonl"
      )?.[1];
    expect(writtenSpans?.split("\n")).toHaveLength(50);
  });

  it("should handle empty projects gracefully", async () => {
    vi.mocked(mockMode.exec).mockResolvedValueOnce({
      stdout: "",
      stderr: "",
      exitCode: 0,
    });

    const mockClient = createMockClient([]);

    await snapshotSpans(mockClient, mockMode);

    expect(mockClient.GET).not.toHaveBeenCalled();
    expect(mockMode.writeFile).not.toHaveBeenCalled();
  });

  it("should handle projects with no spans", async () => {
    const projects = [{ name: "empty-project", id: "proj-1" }];

    vi.mocked(mockMode.exec).mockResolvedValueOnce({
      stdout: projects.map((p) => JSON.stringify(p)).join("\n"),
      stderr: "",
      exitCode: 0,
    });

    const mockClient = createMockClient([
      { data: { data: [], next_cursor: null } },
    ]);

    await snapshotSpans(mockClient, mockMode);

    // Should write empty JSONL file
    expect(mockMode.writeFile).toHaveBeenCalledWith(
      "/phoenix/projects/empty-project/spans/index.jsonl",
      ""
    );

    // Should write metadata with spanCount: 0
    const metadataCall = vi
      .mocked(mockMode.writeFile)
      .mock.calls.find(
        (call) =>
          call[0] === "/phoenix/projects/empty-project/spans/metadata.json"
      );
    const metadata = JSON.parse(metadataCall![1]);
    expect(metadata.spanCount).toBe(0);
  });

  it("should handle API errors gracefully", async () => {
    const projects = [{ name: "project1", id: "proj-1" }];

    vi.mocked(mockMode.exec).mockResolvedValueOnce({
      stdout: projects.map((p) => JSON.stringify(p)).join("\n"),
      stderr: "",
      exitCode: 0,
    });

    const error = new Error("Network error");
    const mockClient = createMockClient([{ data: null, error: error }]);

    await expect(snapshotSpans(mockClient, mockMode)).rejects.toThrow(
      "Unexpected error during fetching spans for project project1: Network error"
    );
  });

  it("should handle project names with special characters", async () => {
    const projects = [
      { name: "my project/with spaces & symbols", id: "proj-1" },
    ];

    vi.mocked(mockMode.exec).mockResolvedValueOnce({
      stdout: projects.map((p) => JSON.stringify(p)).join("\n"),
      stderr: "",
      exitCode: 0,
    });

    const mockClient = createMockClient([
      { data: { data: [], next_cursor: null } },
    ]);

    await snapshotSpans(mockClient, mockMode);

    expect(mockClient.GET).toHaveBeenCalledWith(
      "/v1/projects/{project_identifier}/spans",
      {
        params: {
          path: { project_identifier: "my project/with spaces & symbols" },
          query: { limit: 100 },
        },
      }
    );

    expect(mockMode.writeFile).toHaveBeenCalledWith(
      "/phoenix/projects/my project/with spaces & symbols/spans/index.jsonl",
      ""
    );
  });
});
