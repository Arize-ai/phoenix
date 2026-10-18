import { HttpResponse } from "@arizeai/phoenix-testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { confirmMock, isCancelMock } = vi.hoisted(() => ({
  confirmMock: vi.fn(),
  isCancelMock: vi.fn(),
}));

vi.mock("@clack/prompts", () => ({
  cancel: vi.fn(),
  confirm: confirmMock,
  isCancel: isCancelMock,
}));

import { createProjectCommand } from "../src/commands/project";
import { ExitCode } from "../src/exitCodes";
import { http, setupMockPhoenixServer } from "./mockServer";
import { BASE_ARGS, captureCliOutput, mockProcessExit } from "./testUtils";

const mock = setupMockPhoenixServer();

const PROJECT_ID = "UHJvamVjdDox";
const POLICY_ID = "UHJvamVjdFRyYWNlUmV0ZW50aW9uUG9saWN5OjI=";
const POLICY_LIST_HINT =
  "px api graphql '{ projectTraceRetentionPolicies { edges { node { id name } } } }'";

type CapturedRequest = {
  calls: number;
  projectIdentifier?: string;
  body?: unknown;
};

/**
 * Pin the retention route to echo the requested policy back, recording what
 * the CLI sent so tests can assert on the path and body.
 */
function useRetentionRoute(): CapturedRequest {
  const captured: CapturedRequest = { calls: 0 };
  mock.server.use(
    http.patch(
      "/v1/projects/{project_identifier}/retention",
      async ({ params, request, response }) => {
        captured.calls += 1;
        captured.projectIdentifier = params.project_identifier;
        captured.body = await request.json();
        const { policy_id } = captured.body as { policy_id: string | null };
        return response(200).json({
          data: { project_id: PROJECT_ID, policy_id },
        });
      }
    )
  );
  return captured;
}

function useRetentionError(status: 401 | 403 | 404 | 422, detail: string) {
  mock.server.use(
    http.patch(
      "/v1/projects/{project_identifier}/retention",
      ({ response }) => response(status).text(detail) as never
    )
  );
}

function stdoutText(io: ReturnType<typeof captureCliOutput>): string {
  return String(io.stdout.mock.calls[0]?.[0]);
}

function stderrText(io: ReturnType<typeof captureCliOutput>): string {
  return io.stderr.mock.calls.map((call) => String(call[0])).join("\n");
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe("project retention set", () => {
  it("assigns a policy to a project selected by name", async () => {
    const captured = useRetentionRoute();
    const io = captureCliOutput();

    await createProjectCommand().parseAsync(
      [
        "retention",
        "set",
        "support-bot",
        POLICY_ID,
        "--yes",
        "--format",
        "raw",
        ...BASE_ARGS,
      ],
      { from: "user" }
    );

    expect(captured.calls).toBe(1);
    expect(captured.projectIdentifier).toBe("support-bot");
    expect(captured.body).toEqual({ policy_id: POLICY_ID });
    expect(JSON.parse(stdoutText(io))).toEqual({
      project_id: PROJECT_ID,
      policy_id: POLICY_ID,
    });
  });

  it("accepts a project GlobalID and pretty-prints json output", async () => {
    const captured = useRetentionRoute();
    const io = captureCliOutput();

    await createProjectCommand().parseAsync(
      [
        "retention",
        "set",
        PROJECT_ID,
        POLICY_ID,
        "--yes",
        "--format",
        "json",
        ...BASE_ARGS,
      ],
      { from: "user" }
    );

    expect(captured.projectIdentifier).toBe(PROJECT_ID);
    expect(stdoutText(io)).toBe(
      JSON.stringify({ project_id: PROJECT_ID, policy_id: POLICY_ID }, null, 2)
    );
  });

  it("prints the resulting project and policy IDs as a table by default", async () => {
    useRetentionRoute();
    const io = captureCliOutput();

    await createProjectCommand().parseAsync(
      ["retention", "set", "support-bot", POLICY_ID, "--yes", ...BASE_ARGS],
      { from: "user" }
    );

    const output = stdoutText(io);
    expect(output).toContain("project_id");
    expect(output).toContain("policy_id");
    expect(output).toContain(PROJECT_ID);
    expect(output).toContain(POLICY_ID);
  });
});

describe("project retention reset", () => {
  it("sends an explicit null policy assignment", async () => {
    const captured = useRetentionRoute();
    const io = captureCliOutput();

    await createProjectCommand().parseAsync(
      [
        "retention",
        "reset",
        "support-bot",
        "--yes",
        "--format",
        "raw",
        ...BASE_ARGS,
      ],
      { from: "user" }
    );

    expect(captured.calls).toBe(1);
    expect(captured.projectIdentifier).toBe("support-bot");
    expect(captured.body).toEqual({ policy_id: null });
    expect(Object.keys(captured.body as object)).toContain("policy_id");
    expect(JSON.parse(stdoutText(io))).toEqual({
      project_id: PROJECT_ID,
      policy_id: null,
    });
  });

  it("labels the default policy in pretty output", async () => {
    useRetentionRoute();
    const io = captureCliOutput();

    await createProjectCommand().parseAsync(
      ["retention", "reset", "support-bot", "--yes", ...BASE_ARGS],
      { from: "user" }
    );

    const output = stdoutText(io);
    expect(output).toContain(PROJECT_ID);
    expect(output).toContain("default");
  });
});

describe("project retention confirmation", () => {
  let originalIsTTY: boolean | undefined;

  beforeEach(() => {
    originalIsTTY = process.stdin.isTTY;
    isCancelMock.mockReturnValue(false);
  });

  afterEach(() => {
    Object.defineProperty(process.stdin, "isTTY", {
      value: originalIsTTY,
      configurable: true,
    });
  });

  function setTTY(value: boolean) {
    Object.defineProperty(process.stdin, "isTTY", {
      value,
      configurable: true,
    });
  }

  it("prompts before assigning a policy and proceeds when confirmed", async () => {
    setTTY(true);
    confirmMock.mockResolvedValue(true);
    const captured = useRetentionRoute();
    captureCliOutput();

    await createProjectCommand().parseAsync(
      ["retention", "set", "support-bot", POLICY_ID, ...BASE_ARGS],
      { from: "user" }
    );

    expect(confirmMock).toHaveBeenCalledTimes(1);
    expect(confirmMock.mock.calls[0]?.[0].message).toBe(
      `Assign retention policy ${POLICY_ID} to project support-bot? Traces outside the policy's retention window will be permanently deleted the next time it runs.`
    );
    expect(captured.calls).toBe(1);
  });

  it("does not reset the policy when the prompt is declined", async () => {
    setTTY(true);
    confirmMock.mockResolvedValue(false);
    const captured = useRetentionRoute();
    captureCliOutput();
    const exitSpy = mockProcessExit();

    await expect(
      createProjectCommand().parseAsync(
        ["retention", "reset", "support-bot", ...BASE_ARGS],
        { from: "user" }
      )
    ).rejects.toThrow();

    expect(confirmMock.mock.calls[0]?.[0].message).toBe(
      "Reset project support-bot to the default retention policy? Traces outside the default policy's retention window will be permanently deleted the next time it runs."
    );
    expect(exitSpy.mock.calls[0]).toEqual([ExitCode.CANCELLED]);
    expect(captured.calls).toBe(0);
  });

  it("refuses to run without --yes when stdin is not a TTY", async () => {
    setTTY(false);
    const captured = useRetentionRoute();
    captureCliOutput();
    vi.spyOn(process.stderr, "write").mockImplementation((() => true) as never);
    const exitSpy = mockProcessExit();

    await expect(
      createProjectCommand().parseAsync(
        ["retention", "set", "support-bot", POLICY_ID, ...BASE_ARGS],
        { from: "user" }
      )
    ).rejects.toThrow();

    expect(exitSpy.mock.calls[0]).toEqual([ExitCode.INVALID_ARGUMENT]);
    expect(confirmMock).not.toHaveBeenCalled();
    expect(captured.calls).toBe(0);
  });
});

describe("project retention errors", () => {
  it("maps a 403 to AUTH_REQUIRED with a structured error", async () => {
    useRetentionError(403, "Only admin users can perform this action");
    const io = captureCliOutput();
    const exitSpy = mockProcessExit();

    await expect(
      createProjectCommand().parseAsync(
        [
          "retention",
          "set",
          "support-bot",
          POLICY_ID,
          "--yes",
          "--format",
          "raw",
          ...BASE_ARGS,
        ],
        { from: "user" }
      )
    ).rejects.toThrow(`process.exit:${ExitCode.AUTH_REQUIRED}`);

    expect(exitSpy).toHaveBeenCalledWith(ExitCode.AUTH_REQUIRED);
    const parsed = JSON.parse(stderrText(io));
    expect(parsed.code).toBe("AUTH_REQUIRED");
    expect(parsed.error).toContain("Only admin users can perform this action");
    expect(parsed.hint).toBe("px auth status");
  });

  it("maps a 401 to AUTH_REQUIRED", async () => {
    useRetentionError(401, "Invalid token");
    captureCliOutput();
    const exitSpy = mockProcessExit();

    await expect(
      createProjectCommand().parseAsync(
        ["retention", "reset", "support-bot", "--yes", ...BASE_ARGS],
        { from: "user" }
      )
    ).rejects.toThrow(`process.exit:${ExitCode.AUTH_REQUIRED}`);

    expect(exitSpy).toHaveBeenCalledWith(ExitCode.AUTH_REQUIRED);
  });

  it("maps an invalid policy ID (422) to INVALID_ARGUMENT", async () => {
    useRetentionError(422, "Invalid retention policy ID: not-a-policy");
    const io = captureCliOutput();
    const exitSpy = mockProcessExit();

    await expect(
      createProjectCommand().parseAsync(
        [
          "retention",
          "set",
          "support-bot",
          "not-a-policy",
          "--yes",
          "--format",
          "json",
          ...BASE_ARGS,
        ],
        { from: "user" }
      )
    ).rejects.toThrow(`process.exit:${ExitCode.INVALID_ARGUMENT}`);

    expect(exitSpy).toHaveBeenCalledWith(ExitCode.INVALID_ARGUMENT);
    const parsed = JSON.parse(stderrText(io));
    expect(parsed.code).toBe("INVALID_ARGUMENT");
    expect(parsed.error).toContain("Invalid retention policy ID: not-a-policy");
    expect(parsed.hint).toBe(POLICY_LIST_HINT);
  });

  it("reports a missing project or policy (404) as FAILURE in pretty mode", async () => {
    useRetentionError(404, "Project with identifier missing not found");
    const io = captureCliOutput();
    const exitSpy = mockProcessExit();

    await expect(
      createProjectCommand().parseAsync(
        ["retention", "set", "missing", POLICY_ID, "--yes", ...BASE_ARGS],
        { from: "user" }
      )
    ).rejects.toThrow(`process.exit:${ExitCode.FAILURE}`);

    expect(exitSpy).toHaveBeenCalledWith(ExitCode.FAILURE);
    const stderr = stderrText(io);
    expect(stderr).toContain(
      "Error setting project retention policy: Project with identifier missing not found"
    );
    expect(() => JSON.parse(stderr)).toThrow();
  });

  it("maps a network failure to NETWORK_ERROR", async () => {
    mock.server.use(
      http.patch("/v1/projects/{project_identifier}/retention", () =>
        HttpResponse.error()
      )
    );
    captureCliOutput();
    const exitSpy = mockProcessExit();

    await expect(
      createProjectCommand().parseAsync(
        ["retention", "reset", "support-bot", "--yes", ...BASE_ARGS],
        { from: "user" }
      )
    ).rejects.toThrow(`process.exit:${ExitCode.NETWORK_ERROR}`);

    expect(exitSpy).toHaveBeenCalledWith(ExitCode.NETWORK_ERROR);
  });
});
