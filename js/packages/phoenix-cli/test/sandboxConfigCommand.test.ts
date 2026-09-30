import { beforeEach, describe, expect, it } from "vitest";

import { createSandboxConfigCommand } from "../src/commands/sandboxConfig";
import { ExitCode } from "../src/exitCodes";
import { http, setupMockPhoenixServer } from "./mockServer";
import { BASE_ARGS, captureCliOutput, mockProcessExit } from "./testUtils";

const mock = setupMockPhoenixServer();

beforeEach(() => {
  mock.server.use(
    http.get("/arize_phoenix_version", ({ response }) =>
      response.untyped(new Response("21.0.0", { status: 200 }))
    )
  );
});

const CONFIG = {
  id: "U2FuZGJveENvbmZpZzoy",
  name: "wasm",
  description: null,
  language: "PYTHON" as const,
  backend_type: "WASM",
  is_usable: true,
};

describe("sandbox-config list", () => {
  it("follows pagination and filters by language", async () => {
    const languages: (string | null)[] = [];
    mock.server.use(
      http.get("/v1/sandbox_configs", ({ request, response }) => {
        const url = new URL(request.url);
        languages.push(url.searchParams.get("language"));
        if (url.searchParams.get("cursor")) {
          return response(200).json({
            data: [{ ...CONFIG, id: "U2FuZGJveENvbmZpZzox", is_usable: false }],
            next_cursor: null,
          });
        }
        return response(200).json({ data: [CONFIG], next_cursor: "next" });
      })
    );
    const io = captureCliOutput();

    await createSandboxConfigCommand().parseAsync(
      ["list", "--language", "python", "--format", "raw", ...BASE_ARGS],
      { from: "user" }
    );

    expect(languages).toEqual(["PYTHON", "PYTHON"]);
    const parsed = JSON.parse(String(io.stdout.mock.calls[0]?.[0]));
    expect(parsed.map((config: { id: string }) => config.id)).toEqual([
      "U2FuZGJveENvbmZpZzoy",
      "U2FuZGJveENvbmZpZzox",
    ]);
  });

  it("shows whether each configuration is usable in a pretty table", async () => {
    mock.server.use(
      http.get("/v1/sandbox_configs", ({ response }) =>
        response(200).json({ data: [CONFIG], next_cursor: null })
      )
    );
    const io = captureCliOutput();

    await createSandboxConfigCommand().parseAsync(["list", ...BASE_ARGS], {
      from: "user",
    });

    const table = String(io.stdout.mock.calls[0]?.[0]);
    expect(table).toContain("usable");
    expect(table).toContain(CONFIG.id);
  });

  it("rejects an unknown --language before any request", async () => {
    const io = captureCliOutput();
    mockProcessExit();

    await expect(
      createSandboxConfigCommand().parseAsync(
        ["list", "--language", "rust", "--format", "raw", ...BASE_ARGS],
        { from: "user" }
      )
    ).rejects.toThrow(`process.exit:${ExitCode.INVALID_ARGUMENT}`);

    const envelope = JSON.parse(String(io.stderr.mock.calls[0]?.[0]));
    expect(envelope.code).toBe("INVALID_ARGUMENT");
  });

  it("accepts --format in any case", async () => {
    mock.server.use(
      http.get("/v1/sandbox_configs", ({ response }) =>
        response(200).json({ data: [CONFIG], next_cursor: null })
      )
    );
    const io = captureCliOutput();

    await createSandboxConfigCommand().parseAsync(
      ["list", "--format", "RAW", ...BASE_ARGS],
      { from: "user" }
    );

    expect(JSON.parse(String(io.stdout.mock.calls[0]?.[0]))).toEqual([
      CONFIG,
    ]);
  });

  it("rejects an invalid --format before any request", async () => {
    let listed = false;
    mock.server.use(
      http.get("/v1/sandbox_configs", ({ response }) => {
        listed = true;
        return response(200).json({ data: [CONFIG], next_cursor: null });
      })
    );
    const io = captureCliOutput();
    mockProcessExit();

    await expect(
      createSandboxConfigCommand().parseAsync(
        ["list", "--format", "yaml", ...BASE_ARGS],
        { from: "user" }
      )
    ).rejects.toThrow(`process.exit:${ExitCode.INVALID_ARGUMENT}`);

    expect(listed).toBe(false);
    expect(String(io.stderr.mock.calls[0]?.[0])).toContain(
      "Invalid --format: yaml"
    );
  });

  it("works against the generated handlers alone", async () => {
    const io = captureCliOutput();

    await createSandboxConfigCommand().parseAsync(
      ["list", "--limit", "3", "--format", "raw", ...BASE_ARGS],
      { from: "user" }
    );

    expect(
      Array.isArray(JSON.parse(String(io.stdout.mock.calls[0]?.[0])))
    ).toBe(true);
  });
});
