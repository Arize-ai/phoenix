import { createHttp } from "@arizeai/phoenix-testing";
import { createMockServer, type Server } from "@arizeai/phoenix-testing/node";
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import type { components } from "../../src/__generated__/api/v1";
import type { PhoenixClient } from "../../src/client";
import { HttpError } from "../../src/errors";
import { listSessions } from "../../src/sessions/listSessions";
import { createTestClient } from "../testUtils";

vi.unmock("../../src/utils/serverVersionUtils");

const http = createHttp();
const filterExpression = 'any(span.name == "café & search" for span in spans)';

function createClientAtVersion(
  version: [number, number, number] = [20, 10, 0]
): PhoenixClient {
  const client = createTestClient();
  vi.spyOn(client, "getServerVersion").mockResolvedValue(version);
  return client;
}

const firstSession: components["schemas"]["SessionData"] = {
  id: "session-1",
  session_id: "sess-a",
  project_id: "project-1",
  start_time: "2025-01-01T00:00:00.000Z",
  end_time: "2025-01-01T01:00:00.000Z",
  token_count_prompt: 80,
  token_count_completion: 20,
  token_count_total: 100,
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
  token_count_prompt: 0,
  token_count_completion: 0,
  token_count_total: 0,
  traces: [],
};

let server: Server;

beforeAll(async () => {
  server = await createMockServer();
  server.listen({ onUnhandledRequest: "error" });
});

afterEach(() => {
  server.resetHandlers();
  vi.restoreAllMocks();
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
      client: createClientAtVersion(),
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
      tokenCountPrompt: 80,
      tokenCountCompletion: 20,
      tokenCountTotal: 100,
    });
    expect(sessions[0]?.traces).toHaveLength(1);
    expect(sessions[0]?.traces[0]).toMatchObject({
      id: "trace-1",
      traceId: "t-1",
    });
    expect(sessions[1]?.traces).toHaveLength(0);
    expect(sessions[1]).toMatchObject({
      tokenCountPrompt: 0,
      tokenCountCompletion: 0,
      tokenCountTotal: 0,
    });
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
      client: createClientAtVersion(),
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
      listSessions({ client: createClientAtVersion(), project: "my-project" })
    ).rejects.toThrow("Failed to list sessions");
  });

  describe("filter expressions", () => {
    it("passes the expression unchanged", async () => {
      let receivedFilter: string | null = null;
      server.use(
        http.get(
          "/v1/projects/{project_identifier}/sessions",
          ({ query, response }) => {
            receivedFilter = query.get("filter");
            return response(200).json({ data: [], next_cursor: null });
          }
        )
      );

      await listSessions({
        client: createClientAtVersion(),
        project: "my-project",
        filter: filterExpression,
      });

      expect(receivedFilter).toBe(filterExpression);
    });

    it("rejects unsupported servers before sending a list request", async () => {
      const client = createClientAtVersion([20, 9, 0]);
      const get = vi.spyOn(client, "GET");

      await expect(
        listSessions({
          client,
          project: "my-project",
          filter: filterExpression,
        })
      ).rejects.toThrow(/'filter'.*requires Phoenix server >= 20\.10\.0/);
      expect(get).not.toHaveBeenCalled();
    });

    it.each([undefined, null, ""])(
      "supports old servers without an expression (%s)",
      async (filter) => {
        let hasFilter: boolean | undefined;
        server.use(
          http.get(
            "/v1/projects/{project_identifier}/sessions",
            ({ query, response }) => {
              hasFilter = query.has("filter");
              return response(200).json({ data: [], next_cursor: null });
            }
          )
        );

        await listSessions({
          client: createClientAtVersion([14, 0, 0]),
          project: "my-project",
          filter,
        });

        expect(hasFilter).toBe(false);
      }
    );

    it("preserves filter error messages from the server", async () => {
      server.use(
        http.get("/v1/projects/{project_identifier}/sessions", ({ response }) =>
          response(400).text("invalid name `unknown_field`")
        )
      );

      const error = await listSessions({
        client: createClientAtVersion(),
        project: "my-project",
        filter: "unknown_field > 0",
      }).catch((error: unknown) => error);

      expect(error).toBeInstanceOf(HttpError);
      if (!(error instanceof HttpError))
        throw new Error("Expected an HTTP error");
      expect(error.status).toBe(400);
      expect(await error.response.text()).toBe("invalid name `unknown_field`");
    });

    it("preserves the filter through automatic pagination", async () => {
      const cursors: (string | null)[] = [];
      const filters: (string | null)[] = [];
      server.use(
        http.get(
          "/v1/projects/{project_identifier}/sessions",
          ({ query, response }) => {
            cursors.push(query.get("cursor"));
            filters.push(query.get("filter"));
            return response(200).json({
              data: [],
              next_cursor: cursors.length === 1 ? "second-page" : null,
            });
          }
        )
      );

      await listSessions({
        client: createClientAtVersion(),
        project: "my-project",
        filter: filterExpression,
      });

      expect(cursors).toEqual([null, "second-page"]);
      expect(filters).toEqual([filterExpression, filterExpression]);
    });
  });
});
