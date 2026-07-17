import { createHttp } from "@arizeai/phoenix-testing";
import { createMockServer, type Server } from "@arizeai/phoenix-testing/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { getTraces } from "../../src/traces/getTraces";
import { createTestClient } from "../testUtils";

const http = createHttp();

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

describe("getTraces", () => {
  it("should get traces with basic parameters", async () => {
    server.use(
      http.get("/v1/projects/{project_identifier}/traces", ({ response }) =>
        response(200).json({
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
        })
      )
    );

    const result = await getTraces({
      client: createTestClient(),
      project: { projectName: "test-project" },
    });

    expect(result.traces).toHaveLength(1);
    expect(result.traces[0]?.trace_id).toBe("trace-abc-123");
    expect(result.nextCursor).toBe("next-cursor-123");
  });

  describe("sessionId parameter", () => {
    it("should send session_identifier as array when given a single string", async () => {
      let receivedSessionIdentifiers: string[] | undefined;

      server.use(
        http.get(
          "/v1/projects/{project_identifier}/traces",
          ({ query, response }) => {
            receivedSessionIdentifiers = query.getAll("session_identifier");
            return response(200).json({ next_cursor: null, data: [] });
          }
        )
      );

      await getTraces({
        client: createTestClient(),
        project: { projectName: "test-project" },
        sessionId: "sess-1",
      });

      expect(receivedSessionIdentifiers).toEqual(["sess-1"]);
    });

    it("should send session_identifier as array when given an array", async () => {
      let receivedSessionIdentifiers: string[] | undefined;

      server.use(
        http.get(
          "/v1/projects/{project_identifier}/traces",
          ({ query, response }) => {
            receivedSessionIdentifiers = query.getAll("session_identifier");
            return response(200).json({ next_cursor: null, data: [] });
          }
        )
      );

      await getTraces({
        client: createTestClient(),
        project: { projectName: "test-project" },
        sessionId: ["sess-1", "sess-2"],
      });

      expect(receivedSessionIdentifiers).toEqual(["sess-1", "sess-2"]);
    });

    it("should not send session_identifier when sessionId is undefined", async () => {
      let receivedSessionIdentifiers: string[] | undefined;

      server.use(
        http.get(
          "/v1/projects/{project_identifier}/traces",
          ({ query, response }) => {
            receivedSessionIdentifiers = query.getAll("session_identifier");
            return response(200).json({ next_cursor: null, data: [] });
          }
        )
      );

      await getTraces({
        client: createTestClient(),
        project: { projectName: "test-project" },
      });

      expect(receivedSessionIdentifiers).toEqual([]);
    });
  });
});
