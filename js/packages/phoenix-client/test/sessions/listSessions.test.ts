import { createHttp } from "@arizeai/phoenix-testing";
import { createMockServer, type Server } from "@arizeai/phoenix-testing/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import type { components } from "../../src/__generated__/api/v1";
import { listSessions } from "../../src/sessions/listSessions";
import { createTestClient } from "../testUtils";

const http = createHttp();

const firstSession: components["schemas"]["SessionData"] = {
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
};

const secondSession: components["schemas"]["SessionData"] = {
  id: "session-2",
  session_id: "sess-b",
  project_id: "project-1",
  start_time: "2025-01-02T00:00:00.000Z",
  end_time: "2025-01-02T01:00:00.000Z",
  traces: [],
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

describe("listSessions", () => {
  it("should list sessions without pagination if no next_cursor", async () => {
    let sessionsRequestCount = 0;
    let receivedProjectIdentifier: string | undefined;
    let receivedCursor: string | null = null;
    let receivedLimit: string | null = null;

    server.use(
      http.get(
        "/v1/projects/{project_identifier}/sessions",
        ({ params, request, response }) => {
          sessionsRequestCount += 1;
          receivedProjectIdentifier = params.project_identifier;
          const searchParams = new URL(request.url).searchParams;
          receivedCursor = searchParams.get("cursor");
          receivedLimit = searchParams.get("limit");
          return response(200).json({
            data: [firstSession, secondSession],
            next_cursor: null,
          });
        }
      )
    );

    const sessions = await listSessions({
      client: createTestClient(),
      project: "my-project",
    });

    expect(sessionsRequestCount).toBe(1);
    expect(receivedProjectIdentifier).toBe("my-project");
    // A null cursor is omitted from the query string entirely.
    expect(receivedCursor).toBeNull();
    expect(receivedLimit).toBe("100");

    expect(sessions).toHaveLength(2);
    expect(sessions[0]).toMatchObject({
      id: "session-1",
      sessionId: "sess-a",
      projectId: "project-1",
    });
    expect(sessions[0]?.traces).toHaveLength(1);
    expect(sessions[0]?.traces[0]).toMatchObject({
      id: "trace-1",
      traceId: "t-1",
    });
    expect(sessions[1]?.traces).toHaveLength(0);
  });

  it("should paginate through all sessions", async () => {
    const receivedCursors: Array<string | null> = [];

    server.use(
      http.get(
        "/v1/projects/{project_identifier}/sessions",
        ({ request, response }) => {
          receivedCursors.push(new URL(request.url).searchParams.get("cursor"));
          if (receivedCursors.length === 1) {
            return response(200).json({
              data: [firstSession],
              next_cursor: "cursor1",
            });
          }
          return response(200).json({
            data: [secondSession],
            next_cursor: null,
          });
        }
      )
    );

    const sessions = await listSessions({
      client: createTestClient(),
      project: "my-project",
    });

    expect(sessions).toHaveLength(2);
    // The first request omits the cursor; the second passes the cursor along.
    expect(receivedCursors).toEqual([null, "cursor1"]);
  });

  it("should throw error if API returns no data", async () => {
    server.use(
      http.get("/v1/projects/{project_identifier}/sessions", ({ response }) =>
        response.untyped(
          new Response("{}", {
            status: 200,
            headers: { "Content-Type": "application/json" },
          })
        )
      )
    );

    await expect(
      listSessions({ client: createTestClient(), project: "my-project" })
    ).rejects.toThrow("Failed to list sessions");
  });
});
