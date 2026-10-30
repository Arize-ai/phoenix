import { HttpResponse } from "@arizeai/phoenix-testing";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createProjectCommand } from "../src/commands/project";
import { ExitCode } from "../src/exitCodes";
import { http, setupMockPhoenixServer } from "./mockServer";
import { BASE_ARGS, captureCliOutput, mockProcessExit } from "./testUtils";

const mock = setupMockPhoenixServer();

/**
 * Register a handler for POST /v1/projects that records the request body and
 * the number of calls. Tests that must never reach the network assert
 * `count === 0`.
 */
function captureCreateProjectRequest() {
  const captured: { body?: unknown; count: number } = { count: 0 };
  mock.server.use(
    http.post("/v1/projects", async ({ request, response }) => {
      captured.count += 1;
      captured.body = await request.clone().json();
      return response(200).json({
        data: { id: "proj-new", name: "my-project", description: null },
      });
    })
  );
  return captured;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("project create", () => {
  it("is registered under the project command", () => {
    const projectCommand = createProjectCommand();
    const createCommand = projectCommand.commands.find(
      (command) => command.name() === "create"
    );

    expect(createCommand).toBeDefined();
    expect(createCommand?.options.map((option) => option.long)).toEqual([
      "--name",
      "--endpoint",
      "--api-key",
      "--no-progress",
    ]);
  });

  it("posts exactly { name } and prints the created project ID", async () => {
    const captured = captureCreateProjectRequest();
    const io = captureCliOutput();

    await createProjectCommand().parseAsync(
      ["create", "--name", "my-project", ...BASE_ARGS],
      { from: "user" }
    );

    expect(captured.count).toBe(1);
    expect(captured.body).toEqual({ name: "my-project" });
    expect(io.stdout).toHaveBeenCalledTimes(1);
    expect(io.stdout).toHaveBeenCalledWith(
      "Created project 'my-project' (id: proj-new)"
    );
  });

  it("writes progress to stderr unless --no-progress is passed", async () => {
    captureCreateProjectRequest();
    const io = captureCliOutput();

    await createProjectCommand().parseAsync(
      ["create", "--name", "my-project", "--endpoint", "http://localhost:6006"],
      { from: "user" }
    );

    expect(io.stderr).toHaveBeenCalledWith("Creating project 'my-project'...");
  });

  it("prints the ID from a schema-generated response", async () => {
    const io = captureCliOutput();

    await createProjectCommand().parseAsync(
      ["create", "--name", "my-project", ...BASE_ARGS],
      { from: "user" }
    );

    expect(io.stdout).toHaveBeenCalledWith(
      expect.stringMatching(/^Created project '.*' \(id: .+\)$/)
    );
  });

  it("exits INVALID_ARGUMENT without a request when --name is missing", async () => {
    const captured = captureCreateProjectRequest();
    const io = captureCliOutput();
    const exitSpy = mockProcessExit();

    await expect(
      createProjectCommand().parseAsync(["create", ...BASE_ARGS], {
        from: "user",
      })
    ).rejects.toThrow(`process.exit:${ExitCode.INVALID_ARGUMENT}`);

    expect(exitSpy).toHaveBeenCalledWith(ExitCode.INVALID_ARGUMENT);
    expect(captured.count).toBe(0);
    expect(io.stderr).toHaveBeenCalledWith(
      expect.stringContaining("Missing required flag --name")
    );
  });

  it("exits INVALID_ARGUMENT without a request when the endpoint is empty", async () => {
    const captured = captureCreateProjectRequest();
    const io = captureCliOutput();
    const exitSpy = mockProcessExit();

    await expect(
      createProjectCommand().parseAsync(
        ["create", "--name", "my-project", "--endpoint", "", "--no-progress"],
        { from: "user" }
      )
    ).rejects.toThrow();

    // The handler's catch block re-exits after the mocked `process.exit`
    // throws, so assert on the first exit code, which is what a real process
    // would return.
    expect(exitSpy.mock.calls[0]).toEqual([ExitCode.INVALID_ARGUMENT]);
    expect(captured.count).toBe(0);
    expect(io.stderr).toHaveBeenCalledWith(
      expect.stringContaining("Phoenix endpoint not configured")
    );
  });

  it("exits FAILURE with the server message on a server error", async () => {
    mock.server.use(
      http.post("/v1/projects", ({ response }) =>
        response.untyped(
          new HttpResponse("Invalid project name", {
            status: 422,
            headers: { "Content-Type": "text/plain" },
          })
        )
      )
    );
    const io = captureCliOutput();
    const exitSpy = mockProcessExit();

    await expect(
      createProjectCommand().parseAsync(
        ["create", "--name", "my-project", ...BASE_ARGS],
        { from: "user" }
      )
    ).rejects.toThrow(`process.exit:${ExitCode.FAILURE}`);

    expect(exitSpy).toHaveBeenCalledWith(ExitCode.FAILURE);
    expect(io.stdout).not.toHaveBeenCalled();
    expect(io.stderr).toHaveBeenCalledWith(
      "Error creating project: Failed to create project (HTTP 422): Invalid project name"
    );
  });

  it("exits NETWORK_ERROR when the connection fails", async () => {
    mock.server.use(http.post("/v1/projects", () => HttpResponse.error()));
    const io = captureCliOutput();
    const exitSpy = mockProcessExit();

    await expect(
      createProjectCommand().parseAsync(
        ["create", "--name", "my-project", ...BASE_ARGS],
        { from: "user" }
      )
    ).rejects.toThrow(`process.exit:${ExitCode.NETWORK_ERROR}`);

    expect(exitSpy).toHaveBeenCalledWith(ExitCode.NETWORK_ERROR);
    expect(io.stdout).not.toHaveBeenCalled();
    expect(io.stderr).toHaveBeenCalledWith(
      expect.stringContaining("Error creating project")
    );
  });
});
