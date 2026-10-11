import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { Readable } from "stream";
import { HttpResponse } from "@arizeai/phoenix-testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type * as ConfirmModule from "../src/confirm";

// Mock confirmOrExit so delete tests never wait on a prompt; the env-var gate
// (assertDeletesEnabled) stays real.
vi.mock("../src/confirm", async (importOriginal) => {
  const originalModule = await importOriginal<typeof ConfirmModule>();
  return {
    ...originalModule,
    confirmOrExit: vi.fn().mockResolvedValue(undefined),
  };
});

import {
  createSecretCommand,
  type SecretCommandDeps,
} from "../src/commands/secret";
import { REDACTED } from "../src/commands/secretInput";
import {
  confirmOrExit,
  ENV_PHOENIX_CLI_DANGEROUSLY_ENABLE_DELETES,
} from "../src/confirm";
import { ExitCode } from "../src/exitCodes";
import { http, setupMockPhoenixServer } from "./mockServer";
import { BASE_ARGS, captureCliOutput, mockProcessExit } from "./testUtils";

const mock = setupMockPhoenixServer();

const OPENAI_VALUE = "sk-live-openai-0123456789abcdef";
const ANTHROPIC_VALUE = "sk-ant-anthropic-fedcba9876543210";
const FILE_VALUE = "file-secret-value-with-newline";

interface CapturedPut {
  count: number;
  secrets?: Array<{ key: string; value: string | null }>;
}

/**
 * Register a handler for PUT /v1/secrets that records the request body and
 * answers with the key names it was sent — exactly what the server does.
 */
function captureSecretsPut(): CapturedPut {
  const captured: CapturedPut = { count: 0 };
  mock.server.use(
    http.put("/v1/secrets", async ({ request, response }) => {
      captured.count += 1;
      const body = (await request.clone().json()) as {
        secrets: Array<{ key: string; value: string | null }>;
      };
      captured.secrets = body.secrets;
      return response(200).json({
        data: {
          upserted_keys: body.secrets
            .filter((entry) => entry.value !== null)
            .map((entry) => entry.key),
          deleted_keys: body.secrets
            .filter((entry) => entry.value === null)
            .map((entry) => entry.key),
        },
      });
    })
  );
  return captured;
}

/** A piped (non-TTY) stdin carrying `text`. */
function pipedStdin(text: string): SecretCommandDeps["stdin"] {
  return Readable.from([text]);
}

/** A terminal stdin, so a bare `<key>` falls through to the hidden prompt. */
function ttyStdin(): SecretCommandDeps["stdin"] {
  return Object.assign(Readable.from([]), { isTTY: true });
}

/** Everything the CLI wrote to either stream, joined for leak assertions. */
function allOutput(io: ReturnType<typeof captureCliOutput>): string {
  return [...io.stdout.mock.calls, ...io.stderr.mock.calls]
    .flat()
    .map(String)
    .join("\n");
}

function useIsolatedProfilesDir() {
  let tmpDir: string;
  let originalXdg: string | undefined;
  beforeEach(() => {
    originalXdg = process.env.XDG_CONFIG_HOME;
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "phoenix-secret-test-"));
    process.env.XDG_CONFIG_HOME = tmpDir;
  });
  afterEach(() => {
    if (originalXdg === undefined) {
      delete process.env.XDG_CONFIG_HOME;
    } else {
      process.env.XDG_CONFIG_HOME = originalXdg;
    }
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
}

function useTempDir(): { readonly path: string } {
  let dir: string;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "phoenix-secret-files-"));
  });
  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });
  return {
    get path() {
      return dir;
    },
  };
}

describe("secret set", () => {
  useIsolatedProfilesDir();
  const files = useTempDir();
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("reads the value from piped stdin, strips one trailing newline, and prints only key names", async () => {
    const captured = captureSecretsPut();
    const io = captureCliOutput();

    await createSecretCommand({
      stdin: pipedStdin(`${OPENAI_VALUE}\n`),
    }).parseAsync(["set", "OPENAI_API_KEY", "--format", "raw", ...BASE_ARGS], {
      from: "user",
    });

    expect(captured.count).toBe(1);
    expect(captured.secrets).toEqual([
      { key: "OPENAI_API_KEY", value: OPENAI_VALUE },
    ]);
    expect(io.stdout).toHaveBeenCalledWith(
      JSON.stringify({ upserted_keys: ["OPENAI_API_KEY"], deleted_keys: [] })
    );
    expect(allOutput(io)).not.toContain(OPENAI_VALUE);
  });

  it("is also reachable through the `upsert` alias", async () => {
    const captured = captureSecretsPut();
    captureCliOutput();

    await createSecretCommand({
      stdin: pipedStdin(OPENAI_VALUE),
    }).parseAsync(["upsert", "OPENAI_API_KEY", ...BASE_ARGS], {
      from: "user",
    });

    expect(captured.count).toBe(1);
    expect(captured.secrets?.[0]?.key).toBe("OPENAI_API_KEY");
  });

  it("renders a pretty summary naming the upserted keys and writes progress to stderr", async () => {
    captureSecretsPut();
    const io = captureCliOutput();

    await createSecretCommand({
      stdin: pipedStdin(OPENAI_VALUE),
    }).parseAsync(["set", "OPENAI_API_KEY", "--endpoint", BASE_ARGS[1]], {
      from: "user",
    });

    expect(io.stdout).toHaveBeenCalledWith(
      "Upserted 1 secret(s): OPENAI_API_KEY"
    );
    expect(io.stderr).toHaveBeenCalledWith(
      "Upserting 1 secret(s): OPENAI_API_KEY"
    );
    expect(allOutput(io)).not.toContain(OPENAI_VALUE);
  });

  it("reads the value from --value-file", async () => {
    const captured = captureSecretsPut();
    const io = captureCliOutput();
    const file = path.join(files.path, "anthropic.key");
    fs.writeFileSync(file, `${FILE_VALUE}\n`);

    await createSecretCommand({ stdin: pipedStdin("") }).parseAsync(
      ["set", "ANTHROPIC_API_KEY", "--value-file", file, ...BASE_ARGS],
      { from: "user" }
    );

    expect(captured.secrets).toEqual([
      { key: "ANTHROPIC_API_KEY", value: FILE_VALUE },
    ]);
    expect(allOutput(io)).not.toContain(FILE_VALUE);
  });

  it("treats --value-file - as stdin", async () => {
    const captured = captureSecretsPut();
    captureCliOutput();

    await createSecretCommand({
      stdin: pipedStdin(OPENAI_VALUE),
    }).parseAsync(
      ["set", "OPENAI_API_KEY", "--value-file", "-", ...BASE_ARGS],
      {
        from: "user",
      }
    );

    expect(captured.secrets).toEqual([
      { key: "OPENAI_API_KEY", value: OPENAI_VALUE },
    ]);
  });

  it("prompts with hidden input when stdin is a TTY and no --value-file is given", async () => {
    const captured = captureSecretsPut();
    const io = captureCliOutput();
    const promptHiddenValue = vi.fn().mockResolvedValue(OPENAI_VALUE);

    await createSecretCommand({
      stdin: ttyStdin(),
      promptHiddenValue,
    }).parseAsync(["set", "OPENAI_API_KEY", ...BASE_ARGS], { from: "user" });

    expect(promptHiddenValue).toHaveBeenCalledWith(
      expect.stringContaining("OPENAI_API_KEY")
    );
    expect(promptHiddenValue.mock.calls[0][0]).toContain("hidden");
    expect(captured.secrets).toEqual([
      { key: "OPENAI_API_KEY", value: OPENAI_VALUE },
    ]);
    expect(allOutput(io)).not.toContain(OPENAI_VALUE);
  });

  it("exits CANCELLED without a network call when the hidden prompt is cancelled", async () => {
    const captured = captureSecretsPut();
    captureCliOutput();
    const exitSpy = mockProcessExit();

    await expect(
      createSecretCommand({
        stdin: ttyStdin(),
        promptHiddenValue: vi.fn().mockResolvedValue(null),
      }).parseAsync(["set", "OPENAI_API_KEY", ...BASE_ARGS], { from: "user" })
    ).rejects.toThrow(`process.exit:${ExitCode.CANCELLED}`);

    expect(exitSpy).toHaveBeenCalledWith(ExitCode.CANCELLED);
    expect(captured.count).toBe(0);
  });

  it("copies values from the environment by name with --from-env", async () => {
    vi.stubEnv("OPENAI_API_KEY", OPENAI_VALUE);
    vi.stubEnv("ANTHROPIC_API_KEY", ANTHROPIC_VALUE);
    const captured = captureSecretsPut();
    const io = captureCliOutput();

    await createSecretCommand({ stdin: pipedStdin("") }).parseAsync(
      [
        "set",
        "--from-env",
        "OPENAI_API_KEY",
        "--from-env",
        "ANTHROPIC_API_KEY",
        "--format",
        "raw",
        ...BASE_ARGS,
      ],
      { from: "user" }
    );

    expect(captured.count).toBe(1);
    expect(captured.secrets).toEqual([
      { key: "OPENAI_API_KEY", value: OPENAI_VALUE },
      { key: "ANTHROPIC_API_KEY", value: ANTHROPIC_VALUE },
    ]);
    const output = allOutput(io);
    expect(output).toContain("OPENAI_API_KEY");
    expect(output).not.toContain(OPENAI_VALUE);
    expect(output).not.toContain(ANTHROPIC_VALUE);
  });

  it("sends a dotenv --env-file as one atomic batch", async () => {
    const captured = captureSecretsPut();
    const io = captureCliOutput();
    const envFile = path.join(files.path, "secrets.env");
    fs.writeFileSync(
      envFile,
      [
        "# LLM provider keys",
        `OPENAI_API_KEY=${OPENAI_VALUE}`,
        `export ANTHROPIC_API_KEY="${ANTHROPIC_VALUE}"`,
        "",
      ].join("\n")
    );

    await createSecretCommand({ stdin: pipedStdin("") }).parseAsync(
      ["set", "--env-file", envFile, "--format", "json", ...BASE_ARGS],
      { from: "user" }
    );

    expect(captured.count).toBe(1);
    expect(captured.secrets).toEqual([
      { key: "OPENAI_API_KEY", value: OPENAI_VALUE },
      { key: "ANTHROPIC_API_KEY", value: ANTHROPIC_VALUE },
    ]);
    expect(io.stdout).toHaveBeenCalledWith(
      JSON.stringify(
        {
          upserted_keys: ["OPENAI_API_KEY", "ANTHROPIC_API_KEY"],
          deleted_keys: [],
        },
        null,
        2
      )
    );
    expect(allOutput(io)).not.toContain(OPENAI_VALUE);
    expect(allOutput(io)).not.toContain(ANTHROPIC_VALUE);
  });

  it("reads a dotenv batch from stdin with --env-file -", async () => {
    const captured = captureSecretsPut();
    captureCliOutput();

    await createSecretCommand({
      stdin: pipedStdin(`A_KEY=${OPENAI_VALUE}\nB_KEY=${ANTHROPIC_VALUE}\n`),
    }).parseAsync(["set", "--env-file", "-", ...BASE_ARGS], { from: "user" });

    expect(captured.secrets).toEqual([
      { key: "A_KEY", value: OPENAI_VALUE },
      { key: "B_KEY", value: ANTHROPIC_VALUE },
    ]);
  });

  it("combines every source into one request, with the positional key winning duplicates", async () => {
    vi.stubEnv("SHARED_KEY", "from-env");
    vi.stubEnv("ENV_ONLY", ANTHROPIC_VALUE);
    const captured = captureSecretsPut();
    captureCliOutput();
    const envFile = path.join(files.path, "secrets.env");
    fs.writeFileSync(envFile, "SHARED_KEY=from-file\nFILE_ONLY=file-only\n");
    const valueFile = path.join(files.path, "shared.key");
    fs.writeFileSync(valueFile, "from-argument");

    await createSecretCommand({ stdin: pipedStdin("") }).parseAsync(
      [
        "set",
        "SHARED_KEY",
        "--value-file",
        valueFile,
        "--from-env",
        "ENV_ONLY",
        "--env-file",
        envFile,
        ...BASE_ARGS,
      ],
      { from: "user" }
    );

    expect(captured.count).toBe(1);
    expect(captured.secrets).toEqual([
      { key: "SHARED_KEY", value: "from-argument" },
      { key: "FILE_ONLY", value: "file-only" },
      { key: "ENV_ONLY", value: ANTHROPIC_VALUE },
    ]);
  });

  describe("argument validation (no network call)", () => {
    it("rejects KEY=value in argv and never echoes the value", async () => {
      const captured = captureSecretsPut();
      const io = captureCliOutput();
      const exitSpy = mockProcessExit();

      await expect(
        createSecretCommand({ stdin: pipedStdin("") }).parseAsync(
          [
            "set",
            `OPENAI_API_KEY=${OPENAI_VALUE}`,
            "--format",
            "raw",
            ...BASE_ARGS,
          ],
          { from: "user" }
        )
      ).rejects.toThrow(`process.exit:${ExitCode.INVALID_ARGUMENT}`);

      expect(exitSpy).toHaveBeenCalledWith(ExitCode.INVALID_ARGUMENT);
      expect(captured.count).toBe(0);
      const output = allOutput(io);
      expect(output).toContain("must not be passed on the command line");
      expect(output).not.toContain(OPENAI_VALUE);
      const envelope = JSON.parse(io.stderr.mock.calls[0][0] as string);
      expect(envelope.code).toBe("INVALID_ARGUMENT");
    });

    it("exits INVALID_ARGUMENT with a hint when nothing to set is given", async () => {
      const captured = captureSecretsPut();
      const io = captureCliOutput();
      const exitSpy = mockProcessExit();

      await expect(
        createSecretCommand({ stdin: pipedStdin("") }).parseAsync(
          ["set", "--format", "raw", ...BASE_ARGS],
          { from: "user" }
        )
      ).rejects.toThrow(`process.exit:${ExitCode.INVALID_ARGUMENT}`);

      expect(exitSpy).toHaveBeenCalledWith(ExitCode.INVALID_ARGUMENT);
      expect(captured.count).toBe(0);
      const envelope = JSON.parse(io.stderr.mock.calls[0][0] as string);
      expect(envelope.code).toBe("INVALID_ARGUMENT");
      expect(envelope.hint).toContain("px secret set OPENAI_API_KEY");
    });

    it("exits INVALID_ARGUMENT when --value-file is given without a key", async () => {
      const captured = captureSecretsPut();
      captureCliOutput();
      const exitSpy = mockProcessExit();

      await expect(
        createSecretCommand({ stdin: pipedStdin("") }).parseAsync(
          ["set", "--value-file", "./x", ...BASE_ARGS],
          { from: "user" }
        )
      ).rejects.toThrow(`process.exit:${ExitCode.INVALID_ARGUMENT}`);

      expect(exitSpy).toHaveBeenCalledWith(ExitCode.INVALID_ARGUMENT);
      expect(captured.count).toBe(0);
    });

    it("exits INVALID_ARGUMENT when two inputs would both read stdin", async () => {
      const captured = captureSecretsPut();
      const io = captureCliOutput();
      const exitSpy = mockProcessExit();

      await expect(
        createSecretCommand({ stdin: pipedStdin("") }).parseAsync(
          ["set", "OPENAI_API_KEY", "--env-file", "-", ...BASE_ARGS],
          { from: "user" }
        )
      ).rejects.toThrow(`process.exit:${ExitCode.INVALID_ARGUMENT}`);

      expect(exitSpy).toHaveBeenCalledWith(ExitCode.INVALID_ARGUMENT);
      expect(captured.count).toBe(0);
      expect(allOutput(io)).toContain("stdin can supply only one input");
    });

    it("exits INVALID_ARGUMENT when the piped value is empty", async () => {
      const captured = captureSecretsPut();
      const io = captureCliOutput();
      const exitSpy = mockProcessExit();

      await expect(
        createSecretCommand({ stdin: pipedStdin("\n") }).parseAsync(
          ["set", "OPENAI_API_KEY", ...BASE_ARGS],
          { from: "user" }
        )
      ).rejects.toThrow(`process.exit:${ExitCode.INVALID_ARGUMENT}`);

      expect(exitSpy).toHaveBeenCalledWith(ExitCode.INVALID_ARGUMENT);
      expect(captured.count).toBe(0);
      expect(allOutput(io)).toContain("px secret delete OPENAI_API_KEY");
    });

    it("exits INVALID_ARGUMENT when a --from-env variable is unset", async () => {
      vi.stubEnv("DEFINITELY_UNSET_PX_VAR", "");
      const captured = captureSecretsPut();
      const io = captureCliOutput();
      const exitSpy = mockProcessExit();

      await expect(
        createSecretCommand({ stdin: pipedStdin("") }).parseAsync(
          ["set", "--from-env", "DEFINITELY_UNSET_PX_VAR", ...BASE_ARGS],
          { from: "user" }
        )
      ).rejects.toThrow(`process.exit:${ExitCode.INVALID_ARGUMENT}`);

      expect(exitSpy).toHaveBeenCalledWith(ExitCode.INVALID_ARGUMENT);
      expect(captured.count).toBe(0);
      expect(allOutput(io)).toContain(
        "DEFINITELY_UNSET_PX_VAR is not set or is empty"
      );
    });

    it("exits INVALID_ARGUMENT for a missing --value-file, naming the path only", async () => {
      const captured = captureSecretsPut();
      const io = captureCliOutput();
      const exitSpy = mockProcessExit();
      const missing = path.join(files.path, "missing.key");

      await expect(
        createSecretCommand({ stdin: pipedStdin("") }).parseAsync(
          ["set", "OPENAI_API_KEY", "--value-file", missing, ...BASE_ARGS],
          { from: "user" }
        )
      ).rejects.toThrow(`process.exit:${ExitCode.INVALID_ARGUMENT}`);

      expect(exitSpy).toHaveBeenCalledWith(ExitCode.INVALID_ARGUMENT);
      expect(captured.count).toBe(0);
      expect(allOutput(io)).toContain(`Could not read file '${missing}'`);
    });

    it("rejects a malformed --env-file line by line number, after values were already read", async () => {
      const captured = captureSecretsPut();
      const io = captureCliOutput();
      const exitSpy = mockProcessExit();
      const envFile = path.join(files.path, "secrets.env");
      // Line 2 is a bare value: the classic mistake this command must not echo.
      fs.writeFileSync(
        envFile,
        `OPENAI_API_KEY=${OPENAI_VALUE}\n${ANTHROPIC_VALUE}\n`
      );

      await expect(
        createSecretCommand({ stdin: pipedStdin("") }).parseAsync(
          ["set", "--env-file", envFile, ...BASE_ARGS],
          { from: "user" }
        )
      ).rejects.toThrow(`process.exit:${ExitCode.INVALID_ARGUMENT}`);

      expect(exitSpy).toHaveBeenCalledWith(ExitCode.INVALID_ARGUMENT);
      expect(captured.count).toBe(0);
      const output = allOutput(io);
      expect(output).toContain(`line 2 of ${envFile}`);
      expect(output).not.toContain(OPENAI_VALUE);
      expect(output).not.toContain(ANTHROPIC_VALUE);
    });
  });

  describe("server and transport errors", () => {
    it("maps 403 to AUTH_REQUIRED and explains the admin requirement", async () => {
      mock.server.use(
        http.put("/v1/secrets", ({ response }) =>
          response(403).text("Forbidden")
        )
      );
      const io = captureCliOutput();
      const exitSpy = mockProcessExit();

      await expect(
        createSecretCommand({
          stdin: pipedStdin(OPENAI_VALUE),
        }).parseAsync(
          ["set", "OPENAI_API_KEY", "--format", "raw", ...BASE_ARGS],
          {
            from: "user",
          }
        )
      ).rejects.toThrow(`process.exit:${ExitCode.AUTH_REQUIRED}`);

      expect(exitSpy).toHaveBeenCalledWith(ExitCode.AUTH_REQUIRED);
      const envelope = JSON.parse(io.stderr.mock.calls.at(-1)?.[0] as string);
      expect(envelope.code).toBe("AUTH_REQUIRED");
      expect(envelope.error).toContain("admin");
      expect(allOutput(io)).not.toContain(OPENAI_VALUE);
    });

    it("maps 422 to INVALID_ARGUMENT and never surfaces a body that echoes the value", async () => {
      mock.server.use(
        http.put("/v1/secrets", ({ response }) =>
          response(422).text(`Value cannot be empty; got input ${OPENAI_VALUE}`)
        )
      );
      const io = captureCliOutput();
      const exitSpy = mockProcessExit();

      await expect(
        createSecretCommand({
          stdin: pipedStdin(OPENAI_VALUE),
        }).parseAsync(["set", "OPENAI_API_KEY", ...BASE_ARGS], { from: "user" })
      ).rejects.toThrow(`process.exit:${ExitCode.INVALID_ARGUMENT}`);

      expect(exitSpy).toHaveBeenCalledWith(ExitCode.INVALID_ARGUMENT);
      const output = allOutput(io);
      expect(output).toContain("HTTP 422");
      expect(output).not.toContain(OPENAI_VALUE);
    });

    it("maps 507 to FAILURE", async () => {
      mock.server.use(
        http.put("/v1/secrets", ({ response }) =>
          response(507).text("Insufficient Storage")
        )
      );
      captureCliOutput();
      const exitSpy = mockProcessExit();

      await expect(
        createSecretCommand({
          stdin: pipedStdin(OPENAI_VALUE),
        }).parseAsync(["set", "OPENAI_API_KEY", ...BASE_ARGS], { from: "user" })
      ).rejects.toThrow(`process.exit:${ExitCode.FAILURE}`);

      expect(exitSpy).toHaveBeenCalledWith(ExitCode.FAILURE);
    });

    it("exits NETWORK_ERROR when the server is unreachable", async () => {
      mock.server.use(
        http.put("/v1/secrets", ({ response }) =>
          response.untyped(HttpResponse.error())
        )
      );
      const io = captureCliOutput();
      const exitSpy = mockProcessExit();

      await expect(
        createSecretCommand({
          stdin: pipedStdin(OPENAI_VALUE),
        }).parseAsync(
          ["set", "OPENAI_API_KEY", "--format", "raw", ...BASE_ARGS],
          {
            from: "user",
          }
        )
      ).rejects.toThrow(`process.exit:${ExitCode.NETWORK_ERROR}`);

      expect(exitSpy).toHaveBeenCalledWith(ExitCode.NETWORK_ERROR);
      const envelope = JSON.parse(io.stderr.mock.calls.at(-1)?.[0] as string);
      expect(envelope.code).toBe("NETWORK_ERROR");
      expect(allOutput(io)).not.toContain(OPENAI_VALUE);
    });

    it("redacts already-read values from error text the CLI did not author", async () => {
      // An I/O layer whose error message reflects data in flight is the one
      // place a value could leak that the CLI does not author itself. Here
      // --from-env has already been read when the stdin stream for the
      // positional key fails with a message that quotes that value.
      vi.stubEnv("ANTHROPIC_API_KEY", ANTHROPIC_VALUE);
      const captured = captureSecretsPut();
      const failingStdin = new Readable({
        read() {
          this.destroy(
            new Error(`EIO while buffering ${ANTHROPIC_VALUE} for upload`)
          );
        },
      });
      const io = captureCliOutput();
      const exitSpy = mockProcessExit();

      await expect(
        createSecretCommand({ stdin: failingStdin }).parseAsync(
          [
            "set",
            "OPENAI_API_KEY",
            "--from-env",
            "ANTHROPIC_API_KEY",
            "--format",
            "raw",
            ...BASE_ARGS,
          ],
          { from: "user" }
        )
      ).rejects.toThrow(`process.exit:${ExitCode.FAILURE}`);

      expect(exitSpy).toHaveBeenCalledWith(ExitCode.FAILURE);
      expect(captured.count).toBe(0);
      const envelope = JSON.parse(io.stderr.mock.calls.at(-1)?.[0] as string);
      expect(envelope.code).toBe("FAILURE");
      expect(envelope.error).toBe(
        `Error setting secrets: EIO while buffering ${REDACTED} for upload`
      );
      expect(allOutput(io)).not.toContain(ANTHROPIC_VALUE);
    });
  });

  it("works end-to-end against the spec-generated handlers with no pinned response", async () => {
    const io = captureCliOutput();

    await createSecretCommand({
      stdin: pipedStdin(OPENAI_VALUE),
    }).parseAsync(["set", "OPENAI_API_KEY", "--format", "raw", ...BASE_ARGS], {
      from: "user",
    });

    expect(io.stdout).toHaveBeenCalledTimes(1);
    const result = JSON.parse(io.stdout.mock.calls[0][0] as string);
    expect(Array.isArray(result.upserted_keys)).toBe(true);
    expect(Array.isArray(result.deleted_keys)).toBe(true);
    expect(allOutput(io)).not.toContain(OPENAI_VALUE);
  });
});

describe("secret delete", () => {
  useIsolatedProfilesDir();
  beforeEach(() => {
    vi.stubEnv(ENV_PHOENIX_CLI_DANGEROUSLY_ENABLE_DELETES, "true");
    vi.mocked(confirmOrExit).mockClear();
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("deletes several keys in one atomic PUT with null values and reports the key names", async () => {
    const captured = captureSecretsPut();
    const io = captureCliOutput();

    await createSecretCommand().parseAsync(
      [
        "delete",
        "OPENAI_API_KEY",
        "ANTHROPIC_API_KEY",
        "--yes",
        "--endpoint",
        BASE_ARGS[1],
      ],
      { from: "user" }
    );

    expect(captured.count).toBe(1);
    expect(captured.secrets).toEqual([
      { key: "OPENAI_API_KEY", value: null },
      { key: "ANTHROPIC_API_KEY", value: null },
    ]);
    expect(io.stderr).toHaveBeenCalledWith(
      "Deleted 2 secret(s): OPENAI_API_KEY, ANTHROPIC_API_KEY"
    );
    expect(io.stdout).not.toHaveBeenCalled();
  });

  it("de-duplicates keys and lists them in the confirmation message", async () => {
    const captured = captureSecretsPut();
    captureCliOutput();

    await createSecretCommand().parseAsync(
      ["delete", "OPENAI_API_KEY", "OPENAI_API_KEY", "B_KEY", ...BASE_ARGS],
      { from: "user" }
    );

    expect(vi.mocked(confirmOrExit)).toHaveBeenCalledWith(
      expect.objectContaining({
        message:
          "Delete 2 secret(s) (OPENAI_API_KEY, B_KEY)? This cannot be undone.",
      })
    );
    expect(captured.secrets).toEqual([
      { key: "OPENAI_API_KEY", value: null },
      { key: "B_KEY", value: null },
    ]);
  });

  it("passes --yes through to confirmOrExit", async () => {
    captureSecretsPut();
    captureCliOutput();

    await createSecretCommand().parseAsync(
      ["delete", "OPENAI_API_KEY", "-y", ...BASE_ARGS],
      { from: "user" }
    );

    expect(vi.mocked(confirmOrExit)).toHaveBeenCalledWith(
      expect.objectContaining({ yes: true })
    );
  });

  it("exits INVALID_ARGUMENT before any network call when deletes are disabled", async () => {
    vi.stubEnv(ENV_PHOENIX_CLI_DANGEROUSLY_ENABLE_DELETES, "false");
    const captured = captureSecretsPut();
    captureCliOutput();
    const exitSpy = mockProcessExit();

    await expect(
      createSecretCommand().parseAsync(
        ["delete", "OPENAI_API_KEY", "--yes", ...BASE_ARGS],
        { from: "user" }
      )
    ).rejects.toThrow(`process.exit:${ExitCode.INVALID_ARGUMENT}`);

    expect(exitSpy).toHaveBeenCalledWith(ExitCode.INVALID_ARGUMENT);
    expect(captured.count).toBe(0);
    expect(vi.mocked(confirmOrExit)).not.toHaveBeenCalled();
  });

  it("rejects an invalid key without echoing it and without a network call", async () => {
    const captured = captureSecretsPut();
    const io = captureCliOutput();
    const exitSpy = mockProcessExit();

    await expect(
      createSecretCommand().parseAsync(
        ["delete", "OPENAI_API_KEY", OPENAI_VALUE, "--yes", ...BASE_ARGS],
        { from: "user" }
      )
    ).rejects.toThrow(`process.exit:${ExitCode.INVALID_ARGUMENT}`);

    expect(exitSpy).toHaveBeenCalledWith(ExitCode.INVALID_ARGUMENT);
    expect(captured.count).toBe(0);
    expect(vi.mocked(confirmOrExit)).not.toHaveBeenCalled();
    const output = allOutput(io);
    expect(output).toContain("argument 2");
    expect(output).not.toContain(OPENAI_VALUE);
  });

  it("maps 403 to AUTH_REQUIRED", async () => {
    mock.server.use(
      http.put("/v1/secrets", ({ response }) => response(403).text("Forbidden"))
    );
    const io = captureCliOutput();
    const exitSpy = mockProcessExit();

    await expect(
      createSecretCommand().parseAsync(
        ["delete", "OPENAI_API_KEY", "--yes", ...BASE_ARGS],
        { from: "user" }
      )
    ).rejects.toThrow(`process.exit:${ExitCode.AUTH_REQUIRED}`);

    expect(exitSpy).toHaveBeenCalledWith(ExitCode.AUTH_REQUIRED);
    expect(allOutput(io)).toContain("admin");
  });
});
