import { beforeEach, describe, expect, it, vi } from "vitest";

import type { components } from "../../src/__generated__/api/v1";
import { listSessions } from "../../src/sessions/listSessions";

const mockGet = vi.fn();

vi.mock("openapi-fetch", () => ({
  default: () => ({
    GET: mockGet,
    use: () => {},
  }),
}));

const mockSessions: components["schemas"]["GetSessionsResponseBody"]["data"] = [
  {
    id: "session-1",
    session_id: "sess-a",
    project_id: "project-1",
    start_time: "2025-01-01T00:00:00.000Z",
    end_time: "2025-01-01T01:00:00.000Z",
    traces: [
      {
        id: "trace-1",
        trace_id: "t-1",
        start_time: "2025-01-01T00:00:00.000Z",
        end_time: "2025-01-01T00:30:00.000Z",
      },
    ],
  },
  {
    id: "session-2",
    session_id: "sess-b",
    project_id: "project-1",
    start_time: "2025-01-02T00:00:00.000Z",
    end_time: "2025-01-02T01:00:00.000Z",
    traces: [],
  },
];

describe("listSessions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGet.mockReset();
  });

  it("should list sessions without pagination if no next_cursor", async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        data: mockSessions,
      },
    });

    const sessions = await listSessions({
      project: "my-project",
    });

    expect(mockGet).toHaveBeenCalledOnce();
    expect(mockGet).toHaveBeenCalledWith(
      "/v1/projects/{project_identifier}/sessions",
      {
        params: {
          path: {
            project_identifier: "my-project",
          },
          query: {
            cursor: null,
            limit: 100,
          },
        },
      }
    );

    expect(sessions).toHaveLength(2);
    expect(sessions[0]).toMatchObject({
      id: "session-1",
      sessionId: "sess-a",
      projectId: "project-1",
    });
    expect(sessions[0].traces).toHaveLength(1);
    expect(sessions[0].traces[0]).toMatchObject({
      id: "trace-1",
      traceId: "t-1",
    });
    expect(sessions[1].traces).toHaveLength(0);
  });

  it("should paginate through all sessions", async () => {
    mockGet
      .mockResolvedValueOnce({
        data: {
          data: [mockSessions[0]],
          next_cursor: "cursor1",
        },
      })
      .mockResolvedValueOnce({
        data: {
          data: [mockSessions[1]],
          next_cursor: null,
        },
      });

    const sessions = await listSessions({
      project: "my-project",
    });

    expect(mockGet).toHaveBeenCalledTimes(2);
    expect(sessions).toHaveLength(2);

    expect(mockGet).toHaveBeenNthCalledWith(
      2,
      "/v1/projects/{project_identifier}/sessions",
      {
        params: {
          path: {
            project_identifier: "my-project",
          },
          query: {
            cursor: "cursor1",
            limit: 100,
          },
        },
      }
    );
  });

  it("should throw error if API returns no data", async () => {
    mockGet.mockResolvedValueOnce({
      data: undefined,
    });

    await expect(listSessions({ project: "my-project" })).rejects.toThrow(
      "Failed to list sessions"
    );
  });
});
