import { createHttp } from "@arizeai/phoenix-testing";
import { createMockServer, type Server } from "@arizeai/phoenix-testing/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import type { components } from "../../src/__generated__/api/v1";
import { getSession } from "../../src/sessions/getSession";
import { createTestClient } from "../testUtils";

const http = createHttp();

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

describe("getSession", () => {
  it("should get a session by identifier", async () => {
    let sessionRequestCount = 0;
    let receivedSessionIdentifier: string | undefined;

    server.use(
      http.get("/v1/sessions/{session_identifier}", ({ params, response }) => {
        sessionRequestCount += 1;
        receivedSessionIdentifier = params.session_identifier;
        return response(200).json({ data: mockSessionData });
      })
    );

    const session = await getSession({
      client: createTestClient(),
      sessionId: "my-session",
    });

    expect(sessionRequestCount).toBe(1);
    expect(receivedSessionIdentifier).toBe("my-session");

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
    server.use(
      http.get("/v1/sessions/{session_identifier}", ({ response }) =>
        response.untyped(
          new Response("{}", {
            status: 200,
            headers: { "Content-Type": "application/json" },
          })
        )
      )
    );

    await expect(
      getSession({ client: createTestClient(), sessionId: "missing" })
    ).rejects.toThrow("Failed to get session");
  });
});
