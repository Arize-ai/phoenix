import { createHttp } from "@arizeai/phoenix-testing";
import { createMockServer, type Server } from "@arizeai/phoenix-testing/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { getProjects } from "../../src/projects/getProjects";
import type { Project } from "../../src/types/projects";
import { createTestClient } from "../testUtils";

const http = createHttp();

const firstProject: Project = {
  id: "project-1",
  name: "agent-alpha",
  description: "First project",
};

const secondProject: Project = {
  id: "project-2",
  name: "agent-beta",
  description: null,
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

describe("getProjects", () => {
  it("should list projects without pagination if no next_cursor", async () => {
    let projectsRequestCount = 0;
    let receivedCursor: string | null = null;
    let receivedLimit: string | null = null;
    let receivedNameContains: string | null = null;

    server.use(
      http.get("/v1/projects", ({ request, response }) => {
        projectsRequestCount += 1;
        const searchParams = new URL(request.url).searchParams;
        receivedCursor = searchParams.get("cursor");
        receivedLimit = searchParams.get("limit");
        receivedNameContains = searchParams.get("name_contains");
        return response(200).json({
          data: [firstProject, secondProject],
          next_cursor: null,
        });
      })
    );

    const projects = await getProjects({ client: createTestClient() });

    expect(projectsRequestCount).toBe(1);
    // A null cursor is omitted from the query string entirely.
    expect(receivedCursor).toBeNull();
    expect(receivedLimit).toBe("100");
    // An omitted nameContains must not send the filter at all, otherwise an
    // unfiltered call would narrow the result set.
    expect(receivedNameContains).toBeNull();

    expect(projects).toHaveLength(2);
    expect(projects[0]).toMatchObject({
      id: "project-1",
      name: "agent-alpha",
      description: "First project",
    });
    expect(projects[1]).toMatchObject({ id: "project-2", name: "agent-beta" });
  });

  it("should forward nameContains on every page while paginating", async () => {
    const receivedCursors: Array<string | null> = [];
    const receivedNameContains: Array<string | null> = [];

    server.use(
      http.get("/v1/projects", ({ request, response }) => {
        const searchParams = new URL(request.url).searchParams;
        receivedCursors.push(searchParams.get("cursor"));
        receivedNameContains.push(searchParams.get("name_contains"));
        if (receivedCursors.length === 1) {
          return response(200).json({
            data: [firstProject],
            next_cursor: "cursor1",
          });
        }
        return response(200).json({
          data: [secondProject],
          next_cursor: null,
        });
      })
    );

    const projects = await getProjects({
      client: createTestClient(),
      nameContains: "agent",
    });

    expect(projects).toHaveLength(2);
    // The first request omits the cursor; the second passes the cursor along.
    expect(receivedCursors).toEqual([null, "cursor1"]);
    // The filter must survive the pagination loop, not just the first request.
    expect(receivedNameContains).toEqual(["agent", "agent"]);
  });

  it("should throw error if API returns no data", async () => {
    server.use(
      http.get("/v1/projects", ({ response }) =>
        response.untyped(
          new Response("{}", {
            status: 200,
            headers: { "Content-Type": "application/json" },
          })
        )
      )
    );

    await expect(getProjects({ client: createTestClient() })).rejects.toThrow(
      "Failed to list projects"
    );
  });
});
