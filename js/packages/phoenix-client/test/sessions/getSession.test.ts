import { beforeEach, describe, expect, it, vi } from "vitest";

import type { components } from "../../src/__generated__/api/v1";
import { getSession } from "../../src/sessions/getSession";

const mockGet = vi.fn();

vi.mock("openapi-fetch", () => ({
  default: () => ({
    GET: mockGet,
    use: () => {},
  }),
}));

const mockSessionData: components["schemas"]["SessionData"] = {
  id: "session-global-id",
  session_id: "my-session",
  project_id: "project-1",
  start_time: "2025-01-01T00:00:00.000Z",
  end_time: "2025-01-01T01:00:00.000Z",
  traces: [
    {
      id: "trace-global-id",
      trace_id: "trace-1",
      start_time: "2025-01-01T00:00:00.000Z",
      end_time: "2025-01-01T00:30:00.000Z",
    },
  ],
};

describe("getSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGet.mockReset();
  });

  it("should get a session by identifier", async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        data: mockSessionData,
      },
    });

    const session = await getSession({ sessionId: "my-session" });

    expect(mockGet).toHaveBeenCalledOnce();
    expect(mockGet).toHaveBeenCalledWith("/v1/sessions/{session_identifier}", {
      params: {
        path: {
          session_identifier: "my-session",
        },
      },
    });

    expect(session).toEqual({
      id: "session-global-id",
      sessionId: "my-session",
      projectId: "project-1",
      startTime: "2025-01-01T00:00:00.000Z",
      endTime: "2025-01-01T01:00:00.000Z",
      traces: [
        {
          id: "trace-global-id",
          traceId: "trace-1",
          startTime: "2025-01-01T00:00:00.000Z",
          endTime: "2025-01-01T00:30:00.000Z",
        },
      ],
    });
  });

  it("should throw error if API returns no data", async () => {
    mockGet.mockResolvedValueOnce({
      data: undefined,
    });

    await expect(getSession({ sessionId: "missing" })).rejects.toThrow(
      "Failed to get session"
    );
  });
});
