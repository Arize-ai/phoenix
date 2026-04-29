import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { CommanderError } from "commander";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createProfileCommand } from "../src/commands/profile";
import { type SettingsFile } from "../src/settings";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function writeTempSettings(tmpDir: string, data: SettingsFile): void {
  const pxDir = path.join(tmpDir, "px");
  fs.mkdirSync(pxDir, { recursive: true });
  fs.writeFileSync(
    path.join(pxDir, "settings.json"),
    JSON.stringify(data, null, 2),
    "utf-8"
  );
}

async function runProfileCommand(
  args: string[],
  mocks: {
    logSpy: ReturnType<typeof vi.spyOn>;
    errorSpy: ReturnType<typeof vi.spyOn>;
    exitSpy: ReturnType<typeof vi.spyOn>;
  }
): Promise<void> {
  mocks.logSpy.mockClear();
  mocks.errorSpy.mockClear();
  mocks.exitSpy.mockClear();

  const cmd = createProfileCommand();
  cmd.exitOverride();
  try {
    await cmd.parseAsync(["node", "px", ...args]);
  } catch (err) {
    if (err instanceof CommanderError) {
      return;
    }
    throw err;
  }
}

interface ProfileTestContext {
  tmpDir: string;
  logSpy: ReturnType<typeof vi.spyOn>;
  errorSpy: ReturnType<typeof vi.spyOn>;
  exitSpy: ReturnType<typeof vi.spyOn>;
}

function setupProfileTestContext(prefix: string) {
  const ctx = {} as ProfileTestContext;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    delete process.env.PHOENIX_HOST;
    delete process.env.PHOENIX_API_KEY;
    delete process.env.PHOENIX_PROFILE;

    ctx.tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
    process.env.XDG_CONFIG_HOME = ctx.tmpDir;

    ctx.logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    ctx.errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    ctx.exitSpy = vi
      .spyOn(process, "exit")
      .mockImplementation((_code?: number | string) => {
        throw new Error(`process.exit(${_code})`);
      });
  });

  afterEach(() => {
    process.env = originalEnv;
    fs.rmSync(ctx.tmpDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  return ctx;
}

// ---------------------------------------------------------------------------
// px profile edit (mocked editor) — own test because the lifecycle below
// can't easily drive an interactive editor.
// ---------------------------------------------------------------------------

describe("px profile edit", () => {
  const ctx = setupProfileTestContext("phoenix-profile-edit-");

  it("editor writes valid JSON, profile is persisted", async () => {
    writeTempSettings(ctx.tmpDir, {
      activeProfile: null,
      profiles: { dev: { endpoint: "http://localhost:6006" } },
    });

    const editorScript = path.join(ctx.tmpDir, "editor.sh");
    fs.writeFileSync(
      editorScript,
      `#!/bin/sh\nprintf '{"endpoint":"http://patched:6006"}' > "$1"\n`,
      { mode: 0o755 }
    );
    process.env.PHOENIX_EDITOR = editorScript;

    await runProfileCommand(["edit", "dev"], ctx);

    const data: SettingsFile = JSON.parse(
      fs.readFileSync(path.join(ctx.tmpDir, "px", "settings.json"), "utf-8")
    );
    expect(data.profiles.dev.endpoint).toBe("http://patched:6006");
  });
});

// ---------------------------------------------------------------------------
// End-to-end lifecycle — covers list, create, show, use, delete in one pass.
// ---------------------------------------------------------------------------

describe("px profile lifecycle", () => {
  const ctx = setupProfileTestContext("phoenix-lifecycle-test-");

  it("create --current → list → show → create b → use b → delete a → list", async () => {
    // create "a" as the active profile
    await runProfileCommand(
      ["create", "a", "--endpoint", "http://alpha:6006", "--current"],
      ctx
    );

    // list shows "a" as active
    await runProfileCommand(["list", "--format", "json"], ctx);
    const afterCreate = JSON.parse(
      ctx.logSpy.mock.calls.map((c) => String(c[0])).join("\n")
    );
    expect(afterCreate.profiles).toHaveLength(1);
    expect(afterCreate.profiles[0].name).toBe("a");
    expect(afterCreate.profiles[0].active).toBe(true);

    // show "a" returns its endpoint
    await runProfileCommand(["show", "a", "--format", "json"], ctx);
    const shown = JSON.parse(
      ctx.logSpy.mock.calls.map((c) => String(c[0])).join("\n")
    );
    expect(shown.endpoint).toBe("http://alpha:6006");

    // create "b" then switch active to it
    await runProfileCommand(
      ["create", "b", "--endpoint", "http://beta:6006"],
      ctx
    );
    await runProfileCommand(["use", "b"], ctx);
    const afterUse: SettingsFile = JSON.parse(
      fs.readFileSync(path.join(ctx.tmpDir, "px", "settings.json"), "utf-8")
    );
    expect(afterUse.activeProfile).toBe("b");

    // delete "a"
    await runProfileCommand(["delete", "a", "--yes"], ctx);

    // list now contains only "b"
    await runProfileCommand(["list", "--format", "json"], ctx);
    const afterDelete = JSON.parse(
      ctx.logSpy.mock.calls.map((c) => String(c[0])).join("\n")
    );
    expect(afterDelete.profiles).toHaveLength(1);
    expect(afterDelete.profiles[0].name).toBe("b");
  });
});
