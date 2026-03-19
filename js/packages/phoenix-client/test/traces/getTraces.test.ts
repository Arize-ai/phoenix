import { beforeEach, describe, expect, it, vi } from "vitest";

import { getTraces } from "../../src/traces/getTraces";

const mockGet = vi.fn();
vi.mock("openapi-fetch", () => ({
  default: () => ({
    GET: mockGet,
    use: () => {},
  }),
}));

const defaultMockResponse = {
  data: {
    next_cursor: "next-cursor-123",
    data: [
      {
        id: "VHJhY2U6MQ==",
        trace_id: "trace-abc-123",
        project_id: "UHJvamVjdDox",
        start_time: "2024-01-01T00:00:00Z",
        end_time: "2024-01-01T00:01:00Z",
      },
    ],
  },
  error: null,
};

describe("getTraces", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGet.mockResolvedValue(defaultMockResponse);
  });

  it("should get traces with basic parameters", async () => {
    const result = await getTraces({
      project: { projectName: "test-project" },
    });

    expect(result.traces).toHaveLength(1);
    expect(result.traces[0]?.trace_id).toBe("trace-abc-123");
    expect(result.nextCursor).toBe("next-cursor-123");
  });

  describe("sessionId parameter", () => {
    it("should send session_identifier as array when given a single string", async () => {
      await getTraces({
        project: { projectName: "test-project" },
        sessionId: "sess-1",
      });

      expect(mockGet).toHaveBeenCalledWith(
        "/v1/projects/{project_identifier}/traces",
        expect.objectContaining({
          params: expect.objectContaining({
            query: expect.objectContaining({
              session_identifier: ["sess-1"],
            }),
          }),
        })
      );
    });

    it("should send session_identifier as array when given an array", async () => {
      await getTraces({
        project: { projectName: "test-project" },
        sessionId: ["sess-1", "sess-2"],
      });

      expect(mockGet).toHaveBeenCalledWith(
        "/v1/projects/{project_identifier}/traces",
        expect.objectContaining({
          params: expect.objectContaining({
            query: expect.objectContaining({
              session_identifier: ["sess-1", "sess-2"],
            }),
          }),
        })
      );
    });

    it("should not send session_identifier when sessionId is undefined", async () => {
      await getTraces({
        project: { projectName: "test-project" },
      });

      const callArgs = mockGet.mock.calls[0]?.[1];
      expect(callArgs.params.query).not.toHaveProperty("session_identifier");
    });
  });
});
