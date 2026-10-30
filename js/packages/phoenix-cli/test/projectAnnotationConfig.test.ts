import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { type componentsV1, HttpResponse } from "@arizeai/phoenix-testing";
import type * as ClackPrompts from "@clack/prompts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { confirmMock } = vi.hoisted(() => ({ confirmMock: vi.fn() }));

vi.mock("@clack/prompts", async (importOriginal) => ({
  ...(await importOriginal<typeof ClackPrompts>()),
  confirm: confirmMock,
}));

import { formatProjectAnnotationConfigUnassignOutput } from "../src/commands/formatAnnotationConfigs";
import { createProjectCommand } from "../src/commands/project";
import { ExitCode } from "../src/exitCodes";
import { http, setupMockPhoenixServer } from "./mockServer";
import { BASE_ARGS, captureCliOutput, mockProcessExit } from "./testUtils";

const mock = setupMockPhoenixServer();

type AnnotationConfig =
  | componentsV1["schemas"]["CategoricalAnnotationConfig"]
  | componentsV1["schemas"]["ContinuousAnnotationConfig"]
  | componentsV1["schemas"]["FreeformAnnotationConfig"];

const PROJECT_NAME = "support-bot";
const PROJECT_ID = "UHJvamVjdDox";

const CORRECTNESS: AnnotationConfig = {
  id: "Q2F0ZWdvcmljYWxBbm5vdGF0aW9uQ29uZmlnOjE=",
  name: "correctness",
  type: "CATEGORICAL",
  description: "Is the answer correct?",
  optimization_direction: "MAXIMIZE",
  values: [
    { label: "correct", score: 1 },
    { label: "incorrect", score: 0 },
  ],
};

const REVIEWER_NOTES: AnnotationConfig = {
  id: "RnJlZWZvcm1Bbm5vdGF0aW9uQ29uZmlnOjI=",
  name: "reviewer-notes",
  type: "FREEFORM",
  description: null,
};

const CONFIDENCE: AnnotationConfig = {
  id: "Q29udGludW91c0Fubm90YXRpb25Db25maWc6Mw==",
  name: "confidence",
  type: "CONTINUOUS",
  description: "Model confidence",
  optimization_direction: "MAXIMIZE",
  lower_bound: 0,
  upper_bound: 1,
};

const ALL_CONFIGS = [CONFIDENCE, REVIEWER_NOTES, CORRECTNESS];

let tmpDir: string;
const originalIsTTY = process.stdin.isTTY;

function setStdinIsTTY(value: boolean | undefined) {
  Object.defineProperty(process.stdin, "isTTY", {
    value,
    configurable: true,
  });
}

beforeEach(() => {
  // Keep a developer's real `~/.px/settings.json` out of config resolution.
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "phoenix-pac-test-"));
  vi.stubEnv("XDG_CONFIG_HOME", tmpDir);
  // The project annotation-config client helpers check the server version
  // before each request.
  mock.server.use(
    http.get("/arize_phoenix_version", ({ response }) =>
      response.untyped(new Response("19.20.0", { status: 200 }))
    )
  );
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  confirmMock.mockReset();
  setStdinIsTTY(originalIsTTY);
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function run(args: string[]) {
  return createProjectCommand().parseAsync(["annotation-config", ...args], {
    from: "user",
  });
}

/** Capture GET /v1/projects/{project_identifier}/annotation_configs requests. */
function captureList(configs: AnnotationConfig[]) {
  const captured: { calls: number; projectIdentifier?: string } = {
    calls: 0,
  };
  mock.server.use(
    http.get(
      "/v1/projects/{project_identifier}/annotation_configs",
      ({ params, response }) => {
        captured.calls += 1;
        captured.projectIdentifier = params.project_identifier;
        return response(200).json({ data: configs, next_cursor: null });
      }
    )
  );
  return captured;
}

/** Capture PUT .../annotation_configs/{config_identifier} (assign) requests. */
function captureAssign(config: AnnotationConfig = CORRECTNESS) {
  const captured: {
    calls: number;
    projectIdentifier?: string;
    configIdentifier?: string;
  } = { calls: 0 };
  mock.server.use(
    http.put(
      "/v1/projects/{project_identifier}/annotation_configs/{config_identifier}",
      ({ params, response }) => {
        captured.calls += 1;
        captured.projectIdentifier = params.project_identifier;
        captured.configIdentifier = params.config_identifier;
        return response(200).json({ data: config });
      }
    )
  );
  return captured;
}

/** Capture DELETE .../annotation_configs/{config_identifier} (unassign) requests. */
function captureUnassign() {
  const captured: {
    calls: number;
    projectIdentifier?: string;
    configIdentifier?: string;
  } = { calls: 0 };
  mock.server.use(
    http.delete(
      "/v1/projects/{project_identifier}/annotation_configs/{config_identifier}",
      ({ params, response }) => {
        captured.calls += 1;
        captured.projectIdentifier = params.project_identifier;
        captured.configIdentifier = params.config_identifier;
        return response(204).empty();
      }
    )
  );
  return captured;
}

/**
 * Capture PUT /v1/projects/{project_identifier}/annotation_configs (set)
 * requests. The handler answers with the configs whose IDs were sent, like
 * the server does.
 */
function captureSet() {
  const captured: {
    calls: number;
    projectIdentifier?: string;
    body?: { annotation_config_ids: string[] };
  } = { calls: 0 };
  mock.server.use(
    http.put(
      "/v1/projects/{project_identifier}/annotation_configs",
      async ({ params, request, response }) => {
        captured.calls += 1;
        captured.projectIdentifier = params.project_identifier;
        const body = await request.json();
        captured.body = body;
        const data = ALL_CONFIGS.filter((config) =>
          body.annotation_config_ids.includes(config.id)
        );
        return response(200).json({ data, next_cursor: null });
      }
    )
  );
  return captured;
}

/** Answer GET /v1/annotation_configs (used by `set` to resolve names). */
function captureAllConfigs(configs: AnnotationConfig[] = ALL_CONFIGS) {
  const captured = { calls: 0 };
  mock.server.use(
    http.get("/v1/annotation_configs", ({ response }) => {
      captured.calls += 1;
      return response(200).json({ data: configs, next_cursor: null });
    })
  );
  return captured;
}

/** Answer every project annotation-config route with a plain-text error. */
function respondWithError(status: number, message: string) {
  mock.server.use(
    http.get(
      "/v1/projects/{project_identifier}/annotation_configs",
      ({ response }) => response.untyped(new HttpResponse(message, { status }))
    ),
    http.put(
      "/v1/projects/{project_identifier}/annotation_configs",
      ({ response }) => response.untyped(new HttpResponse(message, { status }))
    ),
    http.put(
      "/v1/projects/{project_identifier}/annotation_configs/{config_identifier}",
      ({ response }) => response.untyped(new HttpResponse(message, { status }))
    ),
    http.delete(
      "/v1/projects/{project_identifier}/annotation_configs/{config_identifier}",
      ({ response }) => response.untyped(new HttpResponse(message, { status }))
    )
  );
}

/** Make every project annotation-config route fail at the network level. */
function respondWithNetworkError() {
  mock.server.use(
    http.get("/v1/projects/{project_identifier}/annotation_configs", () =>
      HttpResponse.error()
    ),
    http.put("/v1/projects/{project_identifier}/annotation_configs", () =>
      HttpResponse.error()
    ),
    http.put(
      "/v1/projects/{project_identifier}/annotation_configs/{config_identifier}",
      () => HttpResponse.error()
    ),
    http.delete(
      "/v1/projects/{project_identifier}/annotation_configs/{config_identifier}",
      () => HttpResponse.error()
    )
  );
}

const LIST_ARGS = ["list", PROJECT_NAME, ...BASE_ARGS];
const ASSIGN_ARGS = ["assign", PROJECT_NAME, "correctness", ...BASE_ARGS];
const UNASSIGN_ARGS = ["unassign", PROJECT_NAME, "correctness", ...BASE_ARGS];
const SET_ARGS = [
  "set",
  PROJECT_NAME,
  "correctness",
  "reviewer-notes",
  ...BASE_ARGS,
  "--yes",
];
const SET_NONE_ARGS = ["set", PROJECT_NAME, "--none", ...BASE_ARGS, "--yes"];

describe("project annotation-config list", () => {
  it("prints the assigned configs as compact JSON in raw mode", async () => {
    const captured = captureList([REVIEWER_NOTES, CORRECTNESS]);
    const io = captureCliOutput();

    await run([...LIST_ARGS, "--format", "raw"]);

    expect(captured.calls).toBe(1);
    expect(captured.projectIdentifier).toBe(PROJECT_NAME);
    expect(io.stdout).toHaveBeenCalledTimes(1);
    expect(io.stdout.mock.calls[0]?.[0]).toBe(
      JSON.stringify([REVIEWER_NOTES, CORRECTNESS])
    );
  });

  it("prints indented JSON in json mode", async () => {
    captureList([CORRECTNESS]);
    const io = captureCliOutput();

    await run([...LIST_ARGS, "--format", "json"]);

    expect(io.stdout.mock.calls[0]?.[0]).toBe(
      JSON.stringify([CORRECTNESS], null, 2)
    );
  });

  it("prints a table by default", async () => {
    captureList([REVIEWER_NOTES, CORRECTNESS]);
    const io = captureCliOutput();

    await run(LIST_ARGS);

    const output = io.stdout.mock.calls[0]?.[0] as string;
    expect(output).toContain("correctness");
    expect(output).toContain(CORRECTNESS.id);
    expect(output).toContain("reviewer-notes");
    expect(output).toContain("FREEFORM");
  });

  it("prints an empty-state message when no configs are assigned", async () => {
    captureList([]);
    const io = captureCliOutput();

    await run(LIST_ARGS);

    expect(io.stdout.mock.calls[0]?.[0]).toBe("No annotation configs found");
  });

  it("prints an empty array in raw mode when no configs are assigned", async () => {
    captureList([]);
    const io = captureCliOutput();

    await run([...LIST_ARGS, "--format", "raw"]);

    expect(io.stdout.mock.calls[0]?.[0]).toBe("[]");
  });

  it("passes a project GlobalID through unchanged", async () => {
    const captured = captureList([CORRECTNESS]);
    captureCliOutput();

    await run(["list", PROJECT_ID, ...BASE_ARGS]);

    expect(captured.projectIdentifier).toBe(PROJECT_ID);
  });

  it.each([
    [401, "Unauthorized", ExitCode.AUTH_REQUIRED, "AUTH_REQUIRED"],
    [403, "Forbidden", ExitCode.AUTH_REQUIRED, "AUTH_REQUIRED"],
    [400, "Invalid cursor: abc", ExitCode.INVALID_ARGUMENT, "INVALID_ARGUMENT"],
    [
      404,
      `Project with name ${PROJECT_NAME} not found`,
      ExitCode.FAILURE,
      "FAILURE",
    ],
  ])(
    "maps a %i response to its exit code and reports the server detail",
    async (status, message, exitCode, code) => {
      respondWithError(status, message);
      const io = captureCliOutput();
      const exitSpy = mockProcessExit();

      await expect(run([...LIST_ARGS, "--format", "raw"])).rejects.toThrow(
        `process.exit:${exitCode}`
      );

      expect(exitSpy).toHaveBeenCalledWith(exitCode);
      expect(io.stdout).not.toHaveBeenCalled();
      expect(JSON.parse(io.stderr.mock.calls[0]?.[0] as string)).toMatchObject({
        error: `Error listing project annotation configs: ${message}`,
        code,
      });
    }
  );

  it("exits NETWORK_ERROR when the connection fails", async () => {
    respondWithNetworkError();
    const io = captureCliOutput();
    const exitSpy = mockProcessExit();

    await expect(run(LIST_ARGS)).rejects.toThrow(
      `process.exit:${ExitCode.NETWORK_ERROR}`
    );

    expect(exitSpy).toHaveBeenCalledWith(ExitCode.NETWORK_ERROR);
    expect(io.stdout).not.toHaveBeenCalled();
  });
});

describe("project annotation-config assign", () => {
  it("PUTs the project and config identifiers and prints the config", async () => {
    const captured = captureAssign();
    const io = captureCliOutput();

    await run([...ASSIGN_ARGS, "--format", "raw"]);

    expect(captured.calls).toBe(1);
    expect(captured.projectIdentifier).toBe(PROJECT_NAME);
    expect(captured.configIdentifier).toBe("correctness");
    expect(io.stdout.mock.calls[0]?.[0]).toBe(JSON.stringify(CORRECTNESS));
  });

  it("passes GlobalIDs through without a lookup", async () => {
    // Unhandled requests fail the test, so a name lookup would too.
    const captured = captureAssign();
    captureCliOutput();

    await run(["assign", PROJECT_ID, CORRECTNESS.id, ...BASE_ARGS]);

    expect(captured.projectIdentifier).toBe(PROJECT_ID);
    expect(captured.configIdentifier).toBe(CORRECTNESS.id);
  });

  it("succeeds again when the config is already assigned", async () => {
    const captured = captureAssign();
    const io = captureCliOutput();

    await run([...ASSIGN_ARGS, "--format", "raw"]);
    await run([...ASSIGN_ARGS, "--format", "raw"]);

    expect(captured.calls).toBe(2);
    expect(io.stdout.mock.calls.map((call) => call[0])).toEqual([
      JSON.stringify(CORRECTNESS),
      JSON.stringify(CORRECTNESS),
    ]);
  });

  it("does not ask for confirmation", async () => {
    captureAssign();
    captureCliOutput();
    setStdinIsTTY(true);

    await run(ASSIGN_ARGS);

    expect(confirmMock).not.toHaveBeenCalled();
  });

  it("prints indented JSON in json mode and a table by default", async () => {
    captureAssign();
    const io = captureCliOutput();

    await run([...ASSIGN_ARGS, "--format", "json"]);
    await run(ASSIGN_ARGS);

    expect(io.stdout.mock.calls[0]?.[0]).toBe(
      JSON.stringify(CORRECTNESS, null, 2)
    );
    const pretty = io.stdout.mock.calls[1]?.[0] as string;
    expect(pretty).toContain("correctness");
    expect(pretty).toContain(CORRECTNESS.id);
  });

  it.each([
    [401, "Unauthorized", ExitCode.AUTH_REQUIRED, "AUTH_REQUIRED"],
    [
      403,
      "Viewers cannot perform this action.",
      ExitCode.AUTH_REQUIRED,
      "AUTH_REQUIRED",
    ],
    [
      404,
      `Project with name ${PROJECT_NAME} not found`,
      ExitCode.FAILURE,
      "FAILURE",
    ],
    [404, "Annotation configuration not found", ExitCode.FAILURE, "FAILURE"],
    [
      422,
      "Invalid project identifier format",
      ExitCode.INVALID_ARGUMENT,
      "INVALID_ARGUMENT",
    ],
  ])(
    "maps a %i response (%s) to its exit code",
    async (status, message, exitCode, code) => {
      respondWithError(status, message);
      const io = captureCliOutput();
      const exitSpy = mockProcessExit();

      await expect(run([...ASSIGN_ARGS, "--format", "json"])).rejects.toThrow(
        `process.exit:${exitCode}`
      );

      expect(exitSpy).toHaveBeenCalledWith(exitCode);
      expect(io.stdout).not.toHaveBeenCalled();
      expect(JSON.parse(io.stderr.mock.calls[0]?.[0] as string)).toMatchObject({
        error: `Error assigning project annotation config: ${message}`,
        code,
      });
    }
  );

  it("writes a plain message in pretty mode", async () => {
    respondWithError(404, "Annotation configuration not found");
    const io = captureCliOutput();
    mockProcessExit();

    await expect(run(ASSIGN_ARGS)).rejects.toThrow(
      `process.exit:${ExitCode.FAILURE}`
    );

    expect(io.stderr.mock.calls[0]?.[0]).toBe(
      "Error assigning project annotation config: Annotation configuration not found"
    );
  });

  it("exits NETWORK_ERROR when the connection fails", async () => {
    respondWithNetworkError();
    captureCliOutput();
    const exitSpy = mockProcessExit();

    await expect(run(ASSIGN_ARGS)).rejects.toThrow(
      `process.exit:${ExitCode.NETWORK_ERROR}`
    );

    expect(exitSpy).toHaveBeenCalledWith(ExitCode.NETWORK_ERROR);
  });
});

describe("project annotation-config unassign", () => {
  it("DELETEs the assignment and prints a raw record", async () => {
    const captured = captureUnassign();
    const io = captureCliOutput();

    await run([...UNASSIGN_ARGS, "--format", "raw"]);

    expect(captured.calls).toBe(1);
    expect(captured.projectIdentifier).toBe(PROJECT_NAME);
    expect(captured.configIdentifier).toBe("correctness");
    expect(io.stdout.mock.calls[0]?.[0]).toBe(
      JSON.stringify({
        unassigned: true,
        project: PROJECT_NAME,
        config: "correctness",
      })
    );
  });

  it("prints a human-readable confirmation by default", async () => {
    captureUnassign();
    const io = captureCliOutput();

    await run(UNASSIGN_ARGS);

    expect(io.stdout.mock.calls[0]?.[0]).toBe(
      `Unassigned annotation config correctness from project ${PROJECT_NAME}. The config was not deleted.`
    );
  });

  it("passes GlobalIDs through without a lookup", async () => {
    const captured = captureUnassign();
    captureCliOutput();

    await run(["unassign", PROJECT_ID, CORRECTNESS.id, ...BASE_ARGS]);

    expect(captured.projectIdentifier).toBe(PROJECT_ID);
    expect(captured.configIdentifier).toBe(CORRECTNESS.id);
  });

  it("succeeds again when the config is not assigned", async () => {
    const captured = captureUnassign();
    const io = captureCliOutput();

    await run([...UNASSIGN_ARGS, "--format", "raw"]);
    await run([...UNASSIGN_ARGS, "--format", "raw"]);

    expect(captured.calls).toBe(2);
    expect(io.stdout).toHaveBeenCalledTimes(2);
  });

  it("does not ask for confirmation or need the delete gate", async () => {
    vi.stubEnv("PHOENIX_CLI_DANGEROUSLY_ENABLE_DELETES", "false");
    const captured = captureUnassign();
    captureCliOutput();
    setStdinIsTTY(true);

    await run(UNASSIGN_ARGS);

    expect(confirmMock).not.toHaveBeenCalled();
    expect(captured.calls).toBe(1);
  });

  it("prints indented JSON in json mode", async () => {
    captureUnassign();
    const io = captureCliOutput();

    await run([...UNASSIGN_ARGS, "--format", "json"]);

    expect(io.stdout.mock.calls[0]?.[0]).toBe(
      JSON.stringify(
        { unassigned: true, project: PROJECT_NAME, config: "correctness" },
        null,
        2
      )
    );
  });

  it.each([
    [401, "Unauthorized", ExitCode.AUTH_REQUIRED, "AUTH_REQUIRED"],
    [403, "Forbidden", ExitCode.AUTH_REQUIRED, "AUTH_REQUIRED"],
    [404, "Annotation configuration not found", ExitCode.FAILURE, "FAILURE"],
    [
      422,
      "Invalid project identifier format",
      ExitCode.INVALID_ARGUMENT,
      "INVALID_ARGUMENT",
    ],
  ])(
    "maps a %i response to its exit code",
    async (status, message, exitCode, code) => {
      respondWithError(status, message);
      const io = captureCliOutput();
      const exitSpy = mockProcessExit();

      await expect(run([...UNASSIGN_ARGS, "--format", "raw"])).rejects.toThrow(
        `process.exit:${exitCode}`
      );

      expect(exitSpy).toHaveBeenCalledWith(exitCode);
      expect(io.stdout).not.toHaveBeenCalled();
      expect(JSON.parse(io.stderr.mock.calls[0]?.[0] as string)).toMatchObject({
        error: `Error unassigning project annotation config: ${message}`,
        code,
      });
    }
  );

  it("exits NETWORK_ERROR when the connection fails", async () => {
    respondWithNetworkError();
    captureCliOutput();
    const exitSpy = mockProcessExit();

    await expect(run(UNASSIGN_ARGS)).rejects.toThrow(
      `process.exit:${ExitCode.NETWORK_ERROR}`
    );

    expect(exitSpy).toHaveBeenCalledWith(ExitCode.NETWORK_ERROR);
  });
});

describe("project annotation-config set", () => {
  it("resolves config names to IDs and PUTs the full set", async () => {
    const lookup = captureAllConfigs();
    const captured = captureSet();
    const io = captureCliOutput();

    await run([...SET_ARGS, "--format", "raw"]);

    expect(lookup.calls).toBe(1);
    expect(captured.calls).toBe(1);
    expect(captured.projectIdentifier).toBe(PROJECT_NAME);
    expect(captured.body).toEqual({
      annotation_config_ids: [CORRECTNESS.id, REVIEWER_NOTES.id],
    });
    expect(io.stdout.mock.calls[0]?.[0]).toBe(
      JSON.stringify([REVIEWER_NOTES, CORRECTNESS])
    );
  });

  it("accepts config GlobalIDs and drops duplicates", async () => {
    captureAllConfigs();
    const captured = captureSet();
    captureCliOutput();

    await run([
      "set",
      PROJECT_ID,
      CONFIDENCE.id,
      "confidence",
      CORRECTNESS.id,
      ...BASE_ARGS,
      "--yes",
    ]);

    expect(captured.projectIdentifier).toBe(PROJECT_ID);
    expect(captured.body).toEqual({
      annotation_config_ids: [CONFIDENCE.id, CORRECTNESS.id],
    });
  });

  it("clears every assignment with --none without a config lookup", async () => {
    // Unhandled requests fail the test, so GET /v1/annotation_configs would.
    const captured = captureSet();
    const io = captureCliOutput();

    await run([...SET_NONE_ARGS, "--format", "raw"]);

    expect(captured.calls).toBe(1);
    expect(captured.body).toEqual({ annotation_config_ids: [] });
    expect(io.stdout.mock.calls[0]?.[0]).toBe("[]");
  });

  it("prints indented JSON in json mode and a table by default", async () => {
    captureAllConfigs();
    captureSet();
    const io = captureCliOutput();

    await run([...SET_ARGS, "--format", "json"]);
    await run(SET_ARGS);

    expect(io.stdout.mock.calls[0]?.[0]).toBe(
      JSON.stringify([REVIEWER_NOTES, CORRECTNESS], null, 2)
    );
    const pretty = io.stdout.mock.calls[1]?.[0] as string;
    expect(pretty).toContain("correctness");
    expect(pretty).toContain("reviewer-notes");
  });

  it("prints the empty-state message after --none in pretty mode", async () => {
    captureSet();
    const io = captureCliOutput();

    await run(SET_NONE_ARGS);

    expect(io.stdout.mock.calls[0]?.[0]).toBe("No annotation configs found");
  });

  it("asks for confirmation without --yes and replaces once confirmed", async () => {
    captureAllConfigs();
    const captured = captureSet();
    captureCliOutput();
    setStdinIsTTY(true);
    confirmMock.mockResolvedValue(true);

    await run(["set", PROJECT_NAME, "correctness", ...BASE_ARGS]);

    expect(confirmMock).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining(
          `Replace the annotation configs assigned to project ${PROJECT_NAME} with correctness?`
        ),
      })
    );
    expect(captured.calls).toBe(1);
  });

  it("names the clear in the confirmation for --none", async () => {
    const captured = captureSet();
    captureCliOutput();
    setStdinIsTTY(true);
    confirmMock.mockResolvedValue(true);

    await run(["set", PROJECT_NAME, "--none", ...BASE_ARGS]);

    expect(confirmMock).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining(
          `Unassign every annotation config from project ${PROJECT_NAME}?`
        ),
      })
    );
    expect(captured.calls).toBe(1);
  });

  it("exits CANCELLED without calling PUT when confirmation is declined", async () => {
    captureAllConfigs();
    const captured = captureSet();
    captureCliOutput();
    setStdinIsTTY(true);
    confirmMock.mockResolvedValue(false);
    const exitSpy = mockProcessExit();

    await expect(
      run(["set", PROJECT_NAME, "correctness", ...BASE_ARGS])
    ).rejects.toThrow("process.exit:");

    // The mocked exit throws, so the handler's catch exits again; the first
    // call is the one a real process would stop at.
    expect(exitSpy).toHaveBeenNthCalledWith(1, ExitCode.CANCELLED);
    expect(captured.calls).toBe(0);
  });

  it("exits INVALID_ARGUMENT without --yes when stdin is not a TTY", async () => {
    const captured = captureSet();
    captureCliOutput();
    setStdinIsTTY(false);
    vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    const exitSpy = mockProcessExit();

    await expect(
      run(["set", PROJECT_NAME, "--none", ...BASE_ARGS])
    ).rejects.toThrow("process.exit:");

    expect(exitSpy).toHaveBeenNthCalledWith(1, ExitCode.INVALID_ARGUMENT);
    expect(confirmMock).not.toHaveBeenCalled();
    expect(captured.calls).toBe(0);
  });

  it("exits INVALID_ARGUMENT before any request without configs or --none", async () => {
    const captured = captureSet();
    const io = captureCliOutput();
    const exitSpy = mockProcessExit();

    await expect(
      run(["set", PROJECT_NAME, ...BASE_ARGS, "--yes", "--format", "raw"])
    ).rejects.toThrow(`process.exit:${ExitCode.INVALID_ARGUMENT}`);

    expect(exitSpy).toHaveBeenCalledWith(ExitCode.INVALID_ARGUMENT);
    expect(JSON.parse(io.stderr.mock.calls[0]?.[0] as string)).toMatchObject({
      error: expect.stringContaining("--none"),
      code: "INVALID_ARGUMENT",
    });
    expect(captured.calls).toBe(0);
  });

  it("exits INVALID_ARGUMENT before any request when configs and --none are combined", async () => {
    const captured = captureSet();
    captureCliOutput();
    const exitSpy = mockProcessExit();

    await expect(
      run(["set", PROJECT_NAME, "correctness", "--none", ...BASE_ARGS, "--yes"])
    ).rejects.toThrow(`process.exit:${ExitCode.INVALID_ARGUMENT}`);

    expect(exitSpy).toHaveBeenCalledWith(ExitCode.INVALID_ARGUMENT);
    expect(captured.calls).toBe(0);
  });

  it("exits FAILURE without calling PUT when a config does not exist", async () => {
    captureAllConfigs();
    const captured = captureSet();
    const io = captureCliOutput();
    const exitSpy = mockProcessExit();

    await expect(
      run([
        "set",
        PROJECT_NAME,
        "correctness",
        "missing-config",
        ...BASE_ARGS,
        "--yes",
        "--format",
        "raw",
      ])
    ).rejects.toThrow(`process.exit:${ExitCode.FAILURE}`);

    expect(exitSpy).toHaveBeenNthCalledWith(1, ExitCode.FAILURE);
    expect(JSON.parse(io.stderr.mock.calls[0]?.[0] as string)).toEqual({
      error: "Annotation config not found: missing-config",
      code: "FAILURE",
      hint: "px annotation-config list",
    });
    expect(captured.calls).toBe(0);
  });

  it.each([
    [401, "Unauthorized", ExitCode.AUTH_REQUIRED, "AUTH_REQUIRED"],
    [403, "Forbidden", ExitCode.AUTH_REQUIRED, "AUTH_REQUIRED"],
    [
      404,
      `Project with name ${PROJECT_NAME} not found`,
      ExitCode.FAILURE,
      "FAILURE",
    ],
    [
      422,
      "One or more annotation configurations were not found",
      ExitCode.INVALID_ARGUMENT,
      "INVALID_ARGUMENT",
    ],
  ])(
    "maps a %i response to its exit code",
    async (status, message, exitCode, code) => {
      respondWithError(status, message);
      const io = captureCliOutput();
      const exitSpy = mockProcessExit();

      await expect(run([...SET_NONE_ARGS, "--format", "raw"])).rejects.toThrow(
        `process.exit:${exitCode}`
      );

      expect(exitSpy).toHaveBeenCalledWith(exitCode);
      expect(io.stdout).not.toHaveBeenCalled();
      expect(JSON.parse(io.stderr.mock.calls[0]?.[0] as string)).toMatchObject({
        error: `Error setting project annotation configs: ${message}`,
        code,
      });
    }
  );

  it("maps a failed config lookup to its exit code", async () => {
    mock.server.use(
      http.get("/v1/annotation_configs", ({ response }) =>
        response.untyped(new HttpResponse("Unauthorized", { status: 401 }))
      )
    );
    const captured = captureSet();
    captureCliOutput();
    const exitSpy = mockProcessExit();

    await expect(run(SET_ARGS)).rejects.toThrow(
      `process.exit:${ExitCode.AUTH_REQUIRED}`
    );

    expect(exitSpy).toHaveBeenCalledWith(ExitCode.AUTH_REQUIRED);
    expect(captured.calls).toBe(0);
  });

  it("exits NETWORK_ERROR when the connection fails", async () => {
    respondWithNetworkError();
    captureCliOutput();
    const exitSpy = mockProcessExit();

    await expect(run(SET_NONE_ARGS)).rejects.toThrow(
      `process.exit:${ExitCode.NETWORK_ERROR}`
    );

    expect(exitSpy).toHaveBeenCalledWith(ExitCode.NETWORK_ERROR);
  });
});

describe("project annotation-config registration", () => {
  it("registers list, assign, unassign, and set under project", () => {
    const group = createProjectCommand().commands.find(
      (command) => command.name() === "annotation-config"
    );

    expect(group?.commands.map((command) => command.name())).toEqual([
      "list",
      "assign",
      "unassign",
      "set",
    ]);
  });
});

describe("formatProjectAnnotationConfigUnassignOutput", () => {
  const result = {
    unassigned: true as const,
    project: PROJECT_NAME,
    config: "correctness",
  };

  it("defaults to pretty output", () => {
    expect(formatProjectAnnotationConfigUnassignOutput({ result })).toBe(
      `Unassigned annotation config correctness from project ${PROJECT_NAME}. The config was not deleted.`
    );
  });

  it("renders compact JSON for raw and indented JSON for json", () => {
    expect(
      formatProjectAnnotationConfigUnassignOutput({ result, format: "raw" })
    ).toBe(JSON.stringify(result));
    expect(
      formatProjectAnnotationConfigUnassignOutput({ result, format: "json" })
    ).toBe(JSON.stringify(result, null, 2));
  });
});
