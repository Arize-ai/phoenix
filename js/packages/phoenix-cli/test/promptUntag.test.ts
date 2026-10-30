import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { HttpResponse } from "@arizeai/phoenix-testing";
import type * as ClackPrompts from "@clack/prompts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { confirmMock } = vi.hoisted(() => ({ confirmMock: vi.fn() }));

vi.mock("@clack/prompts", async (importOriginal) => ({
  ...(await importOriginal<typeof ClackPrompts>()),
  confirm: confirmMock,
}));

import { formatPromptVersionTagDeleteOutput } from "../src/commands/formatPromptVersionTagDelete";
import { createPromptCommand } from "../src/commands/prompt";
import { ENV_PHOENIX_CLI_DANGEROUSLY_ENABLE_DELETES } from "../src/confirm";
import { ExitCode } from "../src/exitCodes";
import { http, setupMockPhoenixServer } from "./mockServer";
import { BASE_ARGS, captureCliOutput, mockProcessExit } from "./testUtils";

const mock = setupMockPhoenixServer();

const PROMPT_VERSION_ID = "UHJvbXB0VmVyc2lvbjox";
const TAG_NAME = "production";
const UNTAG_ARGS = [
  "untag",
  PROMPT_VERSION_ID,
  "--tag",
  TAG_NAME,
  ...BASE_ARGS,
  "--yes",
];

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
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "phoenix-untag-test-"));
  vi.stubEnv("XDG_CONFIG_HOME", tmpDir);
  vi.stubEnv(ENV_PHOENIX_CLI_DANGEROUSLY_ENABLE_DELETES, "true");
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  confirmMock.mockReset();
  setStdinIsTTY(originalIsTTY);
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

/**
 * Register a DELETE /v1/prompt_versions/{id}/tags/{tag_name} handler that
 * records the path params and raw URL of every call.
 */
function captureTagDelete() {
  const captured: {
    calls: number;
    promptVersionId?: string;
    tagName?: string;
    url?: string;
  } = { calls: 0 };
  mock.server.use(
    http.delete(
      "/v1/prompt_versions/{prompt_version_id}/tags/{tag_name}",
      ({ params, request, response }) => {
        captured.calls += 1;
        captured.promptVersionId = params.prompt_version_id;
        captured.tagName = params.tag_name;
        captured.url = request.url;
        return response(204).empty();
      }
    )
  );
  return captured;
}

function respondToTagDelete(status: number, message: string) {
  mock.server.use(
    http.delete(
      "/v1/prompt_versions/{prompt_version_id}/tags/{tag_name}",
      ({ response }) => response.untyped(new HttpResponse(message, { status }))
    )
  );
}

describe("prompt untag", () => {
  it("calls DELETE /v1/prompt_versions/{prompt_version_id}/tags/{tag_name} and prints a raw record", async () => {
    const captured = captureTagDelete();
    const io = captureCliOutput();

    await createPromptCommand().parseAsync([...UNTAG_ARGS, "--format", "raw"], {
      from: "user",
    });

    expect(captured.calls).toBe(1);
    expect(captured.promptVersionId).toBe(PROMPT_VERSION_ID);
    expect(captured.tagName).toBe(TAG_NAME);
    expect(io.stdout).toHaveBeenCalledTimes(1);
    expect(io.stdout.mock.calls[0]?.[0]).toBe(
      JSON.stringify({
        deleted: true,
        prompt_version_id: PROMPT_VERSION_ID,
        tag_name: TAG_NAME,
      })
    );
  });

  it("prints indented JSON with --format json", async () => {
    captureTagDelete();
    const io = captureCliOutput();

    await createPromptCommand().parseAsync(
      [...UNTAG_ARGS, "--format", "json"],
      { from: "user" }
    );

    expect(JSON.parse(io.stdout.mock.calls[0]?.[0] as string)).toEqual({
      deleted: true,
      prompt_version_id: PROMPT_VERSION_ID,
      tag_name: TAG_NAME,
    });
    expect(io.stdout.mock.calls[0]?.[0]).toContain("\n");
  });

  it("prints a human-readable confirmation by default", async () => {
    captureTagDelete();
    const io = captureCliOutput();

    await createPromptCommand().parseAsync(UNTAG_ARGS, { from: "user" });

    expect(io.stdout.mock.calls[0]?.[0]).toBe(
      `Deleted tag "${TAG_NAME}" from prompt version ${PROMPT_VERSION_ID}.`
    );
  });

  it("URL-encodes both path params", async () => {
    const captured = captureTagDelete();
    captureCliOutput();

    await createPromptCommand().parseAsync(
      [
        "untag",
        "UHJvbXB0VmVyc2lvbjoxMA==",
        "--tag",
        "a/b c",
        ...BASE_ARGS,
        "--yes",
      ],
      { from: "user" }
    );

    expect(captured.calls).toBe(1);
    expect(captured.url).toContain(
      "/v1/prompt_versions/UHJvbXB0VmVyc2lvbjoxMA%3D%3D/tags/a%2Fb%20c"
    );
  });

  it.each([
    ["tag", "Tag 'production' not found for prompt version"],
    ["version", "Prompt version not found"],
  ])(
    "exits FAILURE and reports the server error when the %s is missing",
    async (_missing, message) => {
      respondToTagDelete(404, message);
      const io = captureCliOutput();
      const exitSpy = mockProcessExit();

      await expect(
        createPromptCommand().parseAsync(UNTAG_ARGS, { from: "user" })
      ).rejects.toThrow(`process.exit:${ExitCode.FAILURE}`);

      expect(exitSpy).toHaveBeenCalledWith(ExitCode.FAILURE);
      expect(io.stdout).not.toHaveBeenCalled();
      expect(io.stderr).toHaveBeenCalledWith(
        expect.stringMatching(/^Error deleting prompt version tag: .*404/)
      );
    }
  );

  it("exits FAILURE when the server rejects an invalid prompt version ID", async () => {
    respondToTagDelete(422, "Invalid prompt version ID");
    const io = captureCliOutput();
    const exitSpy = mockProcessExit();

    await expect(
      createPromptCommand().parseAsync(UNTAG_ARGS, { from: "user" })
    ).rejects.toThrow(`process.exit:${ExitCode.FAILURE}`);

    expect(exitSpy).toHaveBeenCalledWith(ExitCode.FAILURE);
    expect(io.stderr).toHaveBeenCalledWith(
      expect.stringMatching(/^Error deleting prompt version tag: .*422/)
    );
  });

  it("exits NETWORK_ERROR when the connection fails", async () => {
    mock.server.use(
      http.delete(
        "/v1/prompt_versions/{prompt_version_id}/tags/{tag_name}",
        () => HttpResponse.error()
      )
    );
    const io = captureCliOutput();
    const exitSpy = mockProcessExit();

    await expect(
      createPromptCommand().parseAsync(UNTAG_ARGS, { from: "user" })
    ).rejects.toThrow(`process.exit:${ExitCode.NETWORK_ERROR}`);

    expect(exitSpy).toHaveBeenCalledWith(ExitCode.NETWORK_ERROR);
    expect(io.stdout).not.toHaveBeenCalled();
  });

  it("asks for confirmation without --yes and deletes once confirmed", async () => {
    const captured = captureTagDelete();
    captureCliOutput();
    setStdinIsTTY(true);
    confirmMock.mockResolvedValue(true);

    await createPromptCommand().parseAsync(
      ["untag", PROMPT_VERSION_ID, "--tag", TAG_NAME, ...BASE_ARGS],
      { from: "user" }
    );

    expect(confirmMock).toHaveBeenCalledWith(
      expect.objectContaining({
        message: `Delete tag "${TAG_NAME}" from prompt version ${PROMPT_VERSION_ID}? This cannot be undone.`,
      })
    );
    expect(captured.calls).toBe(1);
  });

  it("exits CANCELLED without calling the API when confirmation is declined", async () => {
    const captured = captureTagDelete();
    captureCliOutput();
    setStdinIsTTY(true);
    confirmMock.mockResolvedValue(false);
    const exitSpy = mockProcessExit();

    await expect(
      createPromptCommand().parseAsync(
        ["untag", PROMPT_VERSION_ID, "--tag", TAG_NAME, ...BASE_ARGS],
        { from: "user" }
      )
    ).rejects.toThrow("process.exit:");

    // The mocked exit throws, so the handler's catch exits again; the first
    // call is the one a real process would stop at.
    expect(exitSpy).toHaveBeenNthCalledWith(1, ExitCode.CANCELLED);
    expect(captured.calls).toBe(0);
  });

  it("exits INVALID_ARGUMENT without --yes when stdin is not a TTY", async () => {
    const captured = captureTagDelete();
    captureCliOutput();
    setStdinIsTTY(false);
    const stderrWrite = vi
      .spyOn(process.stderr, "write")
      .mockImplementation(() => true);
    const exitSpy = mockProcessExit();

    await expect(
      createPromptCommand().parseAsync(
        ["untag", PROMPT_VERSION_ID, "--tag", TAG_NAME, ...BASE_ARGS],
        { from: "user" }
      )
    ).rejects.toThrow("process.exit:");

    // The mocked exit throws, so the handler's catch exits again; the first
    // call is the one a real process would stop at.
    expect(exitSpy).toHaveBeenNthCalledWith(1, ExitCode.INVALID_ARGUMENT);
    expect(stderrWrite).toHaveBeenCalledWith(
      expect.stringContaining("Use --yes to skip confirmation")
    );
    expect(confirmMock).not.toHaveBeenCalled();
    expect(captured.calls).toBe(0);
  });

  it("rejects a missing --tag before any request", async () => {
    const captured = captureTagDelete();
    captureCliOutput();
    const stderrWrite = vi
      .spyOn(process.stderr, "write")
      .mockImplementation(() => true);
    mockProcessExit();

    await expect(
      createPromptCommand().parseAsync(
        ["untag", PROMPT_VERSION_ID, ...BASE_ARGS, "--yes"],
        { from: "user" }
      )
    ).rejects.toThrow("process.exit:");

    expect(stderrWrite).toHaveBeenCalledWith(
      expect.stringContaining(
        "required option '--tag <tag-name>' not specified"
      )
    );
    expect(captured.calls).toBe(0);
  });

  it("exits INVALID_ARGUMENT before any request when deletes are disabled", async () => {
    vi.stubEnv(ENV_PHOENIX_CLI_DANGEROUSLY_ENABLE_DELETES, "false");
    const captured = captureTagDelete();
    captureCliOutput();
    const exitSpy = mockProcessExit();

    await expect(
      createPromptCommand().parseAsync(UNTAG_ARGS, { from: "user" })
    ).rejects.toThrow(`process.exit:${ExitCode.INVALID_ARGUMENT}`);

    expect(exitSpy).toHaveBeenCalledWith(ExitCode.INVALID_ARGUMENT);
    expect(captured.calls).toBe(0);
  });
});

describe("formatPromptVersionTagDeleteOutput", () => {
  const result = {
    deleted: true as const,
    prompt_version_id: PROMPT_VERSION_ID,
    tag_name: TAG_NAME,
  };

  it("defaults to pretty output", () => {
    expect(formatPromptVersionTagDeleteOutput({ result })).toBe(
      `Deleted tag "${TAG_NAME}" from prompt version ${PROMPT_VERSION_ID}.`
    );
  });

  it("renders compact JSON for raw", () => {
    expect(formatPromptVersionTagDeleteOutput({ result, format: "raw" })).toBe(
      JSON.stringify(result)
    );
  });

  it("renders indented JSON for json", () => {
    expect(formatPromptVersionTagDeleteOutput({ result, format: "json" })).toBe(
      JSON.stringify(result, null, 2)
    );
  });
});
