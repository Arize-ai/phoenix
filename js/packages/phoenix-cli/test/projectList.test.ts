import { HttpResponse } from "@arizeai/phoenix-testing";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createProjectCommand } from "../src/commands/project";
import { ExitCode } from "../src/exitCodes";
import { http, setupMockPhoenixServer } from "./mockServer";
import { BASE_ARGS, captureCliOutput, mockProcessExit } from "./testUtils";

const mock = setupMockPhoenixServer();

const PROJECTS = [
  { id: "proj-aaa", name: "alpha", description: "first project" },
  { id: "proj-bbb", name: "beta", description: null },
];

afterEach(() => {
  vi.restoreAllMocks();
});

describe("project list", () => {
  it("excludes experiment projects, propagates --limit, and prints raw JSON", async () => {
    const captured: {
      limit?: string | null;
      includeExperimentProjects?: string | null;
      count: number;
    } = { count: 0 };
    mock.server.use(
      http.get("/v1/projects", ({ request, response }) => {
        captured.count += 1;
        const searchParams = new URL(request.url).searchParams;
        captured.limit = searchParams.get("limit");
        captured.includeExperimentProjects = searchParams.get(
          "include_experiment_projects"
        );
        return response(200).json({ data: PROJECTS, next_cursor: null });
      })
    );
    const io = captureCliOutput();

    await createProjectCommand().parseAsync(
      ["list", "--limit", "50", "--format", "raw", ...BASE_ARGS],
      { from: "user" }
    );

    expect(captured.count).toBe(1);
    expect(captured.limit).toBe("50");
    expect(captured.includeExperimentProjects).toBe("false");
    const parsed = JSON.parse(String(io.stdout.mock.calls[0]?.[0]));
    expect(parsed).toEqual(PROJECTS);
  });

  it("follows next_cursor across pages and concatenates the results", async () => {
    const cursors: (string | null)[] = [];
    mock.server.use(
      http.get("/v1/projects", ({ request, response }) => {
        const cursor = new URL(request.url).searchParams.get("cursor");
        cursors.push(cursor);
        if (cursor === null) {
          return response(200).json({
            data: [PROJECTS[0]],
            next_cursor: "cursor-2",
          });
        }
        return response(200).json({ data: [PROJECTS[1]], next_cursor: null });
      })
    );
    const io = captureCliOutput();

    await createProjectCommand().parseAsync(
      ["list", "--format", "raw", ...BASE_ARGS],
      { from: "user" }
    );

    expect(cursors).toEqual([null, "cursor-2"]);
    const parsed = JSON.parse(String(io.stdout.mock.calls[0]?.[0]));
    expect(parsed).toEqual(PROJECTS);
  });

  it("exits FAILURE with an error message on a server error", async () => {
    mock.server.use(
      http.get("/v1/projects", ({ response }) =>
        response.untyped(HttpResponse.json({}, { status: 500 }))
      )
    );
    const stderrSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const exitSpy = mockProcessExit();

    await expect(
      createProjectCommand().parseAsync(
        ["list", "--format", "raw", ...BASE_ARGS],
        { from: "user" }
      )
    ).rejects.toThrow(`process.exit:${ExitCode.FAILURE}`);

    expect(exitSpy).toHaveBeenCalledWith(ExitCode.FAILURE);
    expect(stderrSpy).toHaveBeenCalledWith(
      expect.stringContaining("Error fetching projects")
    );
  });

  it("exits NETWORK_ERROR when the connection fails", async () => {
    mock.server.use(http.get("/v1/projects", () => HttpResponse.error()));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const exitSpy = mockProcessExit();

    await expect(
      createProjectCommand().parseAsync(
        ["list", "--format", "raw", ...BASE_ARGS],
        { from: "user" }
      )
    ).rejects.toThrow(`process.exit:${ExitCode.NETWORK_ERROR}`);

    expect(exitSpy).toHaveBeenCalledWith(ExitCode.NETWORK_ERROR);
  });

  it("renders a schema-generated page end-to-end", async () => {
    // `fetchProjects` paginates until next_cursor is null, and the generated
    // OpenAPI handler always emits a non-null cursor (unlike the other list
    // commands, `project list` has no --limit early exit), so running the CLI
    // against the pure generated handler would never terminate. Instead,
    // fetch one generated page directly and replay it with the cursor
    // nulled — the payload the CLI consumes is still entirely
    // schema-generated.
    const generatedResponse = await fetch(
      "http://localhost:6006/v1/projects?limit=100"
    );
    const generatedPage = (await generatedResponse.json()) as {
      data: unknown[];
      next_cursor: string | null;
    };
    expect(generatedPage.data.length).toBeGreaterThan(0);
    mock.server.use(
      http.get("/v1/projects", ({ response }) =>
        response.untyped(
          HttpResponse.json({ ...generatedPage, next_cursor: null })
        )
      )
    );
    const io = captureCliOutput();

    await createProjectCommand().parseAsync(
      ["list", "--format", "raw", ...BASE_ARGS],
      { from: "user" }
    );

    const parsed = JSON.parse(String(io.stdout.mock.calls[0]?.[0]));
    expect(parsed).toEqual(generatedPage.data);
  });
});
