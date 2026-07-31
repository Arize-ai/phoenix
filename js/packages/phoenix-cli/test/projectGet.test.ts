import { afterEach, describe, expect, it, vi } from "vitest";

import { createProjectCommand } from "../src/commands/project";
import { ExitCode } from "../src/exitCodes";
import { http, setupMockPhoenixServer } from "./mockServer";
import { BASE_ARGS, captureCliOutput, mockProcessExit } from "./testUtils";

const mock = setupMockPhoenixServer();

function usePinnedProjectPage() {
  mock.server.use(
    http.get("/v1/projects", ({ response }) =>
      response(200).json({
        data: [
          { id: "proj-aaa", name: "alpha", description: "first project" },
          { id: "proj-bbb", name: "beta", description: null },
        ],
        next_cursor: null,
      })
    )
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("project get", () => {
  it("returns the matching project as a bare object in raw mode", async () => {
    usePinnedProjectPage();
    const io = captureCliOutput();

    await createProjectCommand().parseAsync(
      ["get", "alpha", "--format", "raw", ...BASE_ARGS],
      { from: "user" }
    );

    const output = io.stdout.mock.calls[0]?.[0];
    const parsed = JSON.parse(String(output));
    expect(parsed).toEqual({
      id: "proj-aaa",
      name: "alpha",
      description: "first project",
    });
  });

  it("returns the matching project as a bare object in json mode", async () => {
    usePinnedProjectPage();
    const io = captureCliOutput();

    await createProjectCommand().parseAsync(
      ["get", "beta", "--format", "json", ...BASE_ARGS],
      { from: "user" }
    );

    const output = io.stdout.mock.calls[0]?.[0];
    const parsed = JSON.parse(String(output));
    expect(parsed).toEqual({
      id: "proj-bbb",
      name: "beta",
      description: null,
    });
  });

  it("emits a StructuredError on miss and exits FAILURE", async () => {
    usePinnedProjectPage();
    const io = captureCliOutput();
    const exitSpy = mockProcessExit();

    await expect(
      createProjectCommand().parseAsync(
        ["get", "nonexistent", "--format", "raw", ...BASE_ARGS],
        { from: "user" }
      )
    ).rejects.toThrow(`process.exit:${ExitCode.FAILURE}`);

    expect(exitSpy).toHaveBeenCalledWith(ExitCode.FAILURE);
    const stderrCall = io.stderr.mock.calls[0]?.[0];
    const parsed = JSON.parse(String(stderrCall));
    expect(parsed.error).toContain("not found");
    expect(parsed.code).toBe("FAILURE");
    expect(parsed.hint).toBe("px project list --format raw");
  });

  it("emits a human-readable error on miss in pretty mode", async () => {
    usePinnedProjectPage();
    const io = captureCliOutput();
    const exitSpy = mockProcessExit();

    await expect(
      createProjectCommand().parseAsync(["get", "nonexistent", ...BASE_ARGS], {
        from: "user",
      })
    ).rejects.toThrow(`process.exit:${ExitCode.FAILURE}`);

    expect(exitSpy).toHaveBeenCalledWith(ExitCode.FAILURE);
    const stderrCall = io.stderr.mock.calls[0]?.[0];
    expect(String(stderrCall)).toContain("Project 'nonexistent' not found");
  });

  it("does NOT envelope the response in json mode (single-record convention)", async () => {
    usePinnedProjectPage();
    const io = captureCliOutput();

    await createProjectCommand().parseAsync(
      ["get", "alpha", "--format", "json", ...BASE_ARGS],
      { from: "user" }
    );

    const output = io.stdout.mock.calls[0]?.[0];
    const parsed = JSON.parse(String(output));
    expect(Array.isArray(parsed)).toBe(false);
    expect(parsed.id).toBe("proj-aaa");
  });
});
