import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { CommanderError } from "commander";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createProfileCommand } from "../src/commands/profile";
import { API_KEY_MASK } from "../src/commands/formatProfiles";
import type { SettingsFile } from "../src/settings";

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

function readSettings(tmpDir: string): SettingsFile {
  return JSON.parse(
    fs.readFileSync(path.join(tmpDir, "px", "settings.json"), "utf-8")
  );
}

function logCalls(spy: ReturnType<typeof vi.spyOn>): string {
  return spy.mock.calls.map((c) => String(c[0])).join("\n");
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

  it("editor writes valid JSON, profile is persisted and confirmation is printed", async () => {
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

    const data = readSettings(ctx.tmpDir);
    expect(data.profiles.dev.endpoint).toBe("http://patched:6006");
    expect(logCalls(ctx.logSpy)).toBe('Updated profile "dev".');
  });
});

// ---------------------------------------------------------------------------
// End-to-end lifecycle — covers list, create, show, use, delete in one pass.
// ---------------------------------------------------------------------------

describe("px profile lifecycle", () => {
  const ctx = setupProfileTestContext("phoenix-lifecycle-test-");

  it("create --activate → list → show → create b → use b → delete a → list", async () => {
    // create "a" as the active profile (using new --activate flag name)
    await runProfileCommand(
      ["create", "a", "--endpoint", "http://alpha:6006", "--activate"],
      ctx
    );
    expect(logCalls(ctx.logSpy)).toBe(
      'Created profile "a" and set as active.'
    );

    // list shows "a" as active
    await runProfileCommand(["list", "--format", "json"], ctx);
    const afterCreate = JSON.parse(logCalls(ctx.logSpy));
    expect(afterCreate.profiles).toHaveLength(1);
    expect(afterCreate.profiles[0].name).toBe("a");
    expect(afterCreate.profiles[0].active).toBe(true);

    // show "a" returns its endpoint
    await runProfileCommand(["show", "a", "--format", "json"], ctx);
    const shown = JSON.parse(logCalls(ctx.logSpy));
    expect(shown.endpoint).toBe("http://alpha:6006");

    // create "b" without activating — confirmation should NOT mention "set as active"
    await runProfileCommand(
      ["create", "b", "--endpoint", "http://beta:6006"],
      ctx
    );
    expect(logCalls(ctx.logSpy)).toBe('Created profile "b".');

    // use "b" — confirmation should show transition
    await runProfileCommand(["use", "b"], ctx);
    expect(logCalls(ctx.logSpy)).toBe("Switched active profile: a → b");
    expect(readSettings(ctx.tmpDir).activeProfile).toBe("b");

    // use "b" again — already active
    await runProfileCommand(["use", "b"], ctx);
    expect(logCalls(ctx.logSpy)).toBe("Already active: b");

    // delete "a"
    await runProfileCommand(["delete", "a", "--yes"], ctx);
    expect(logCalls(ctx.logSpy)).toBe('Deleted profile "a".');

    // list now contains only "b"
    await runProfileCommand(["list", "--format", "json"], ctx);
    const afterDelete = JSON.parse(logCalls(ctx.logSpy));
    expect(afterDelete.profiles).toHaveLength(1);
    expect(afterDelete.profiles[0].name).toBe("b");
  });
});

// ---------------------------------------------------------------------------
// use semantics — first activation, transition, no-op
// ---------------------------------------------------------------------------

describe("px profile use", () => {
  const ctx = setupProfileTestContext("phoenix-profile-use-");

  it("first activation when nothing was active", async () => {
    writeTempSettings(ctx.tmpDir, {
      activeProfile: null,
      profiles: { staging: { endpoint: "http://staging:6006" } },
    });

    await runProfileCommand(["use", "staging"], ctx);
    expect(logCalls(ctx.logSpy)).toBe("Active profile set to staging");
    expect(readSettings(ctx.tmpDir).activeProfile).toBe("staging");
  });

  it("deleting the active profile clears activeProfile and reports it in the confirmation", async () => {
    writeTempSettings(ctx.tmpDir, {
      activeProfile: "staging",
      profiles: { staging: { endpoint: "http://staging:6006" } },
    });

    await runProfileCommand(["delete", "staging", "--yes"], ctx);
    expect(logCalls(ctx.logSpy)).toContain(
      'Deleted profile "staging" (was the active profile'
    );
    expect(readSettings(ctx.tmpDir).activeProfile).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// API key handling — wired through create, masked in show output, never raw
// ---------------------------------------------------------------------------

describe("px profile create --api-key", () => {
  const ctx = setupProfileTestContext("phoenix-profile-apikey-");

  it("persists the apiKey in settings.json verbatim", async () => {
    await runProfileCommand(
      [
        "create",
        "prod",
        "--endpoint",
        "https://phoenix.example.com",
        "--api-key",
        "sk-secret-value",
      ],
      ctx
    );

    const data = readSettings(ctx.tmpDir);
    expect(data.profiles.prod.apiKey).toBe("sk-secret-value");
  });

  it("create confirmation does not echo the apiKey", async () => {
    await runProfileCommand(
      [
        "create",
        "prod",
        "--endpoint",
        "https://phoenix.example.com",
        "--api-key",
        "sk-secret-value",
      ],
      ctx
    );

    const out = logCalls(ctx.logSpy);
    expect(out).not.toContain("sk-secret-value");
  });

  it("show --format json masks the apiKey", async () => {
    writeTempSettings(ctx.tmpDir, {
      activeProfile: "prod",
      profiles: {
        prod: {
          endpoint: "https://phoenix.example.com",
          apiKey: "sk-secret-value",
        },
      },
    });

    await runProfileCommand(["show", "prod", "--format", "json"], ctx);
    const shown = JSON.parse(logCalls(ctx.logSpy));
    expect(shown.apiKey).toBe(API_KEY_MASK);
    expect(JSON.stringify(shown)).not.toContain("sk-secret-value");
  });

  it("list --format json masks the apiKey across entries", async () => {
    writeTempSettings(ctx.tmpDir, {
      activeProfile: "prod",
      profiles: {
        prod: {
          endpoint: "https://phoenix.example.com",
          apiKey: "sk-secret-value",
        },
        dev: {
          endpoint: "http://localhost:6006",
        },
      },
    });

    await runProfileCommand(["list", "--format", "json"], ctx);
    const parsed = JSON.parse(logCalls(ctx.logSpy));
    const prodEntry = parsed.profiles.find(
      (p: { name: string }) => p.name === "prod"
    );
    const devEntry = parsed.profiles.find(
      (p: { name: string }) => p.name === "dev"
    );
    expect(prodEntry.apiKey).toBe(API_KEY_MASK);
    expect(devEntry.apiKey).toBeUndefined();
    expect(JSON.stringify(parsed)).not.toContain("sk-secret-value");
  });
});

// ---------------------------------------------------------------------------
// list pretty output — kubectl-style "current" column header
// ---------------------------------------------------------------------------

describe("px profile list (pretty output)", () => {
  const ctx = setupProfileTestContext("phoenix-profile-list-pretty-");

  it("renders a `current` column header with `*` marking the active profile", async () => {
    writeTempSettings(ctx.tmpDir, {
      activeProfile: "prod",
      profiles: {
        prod: { endpoint: "https://phoenix.example.com", project: "main" },
        dev: { endpoint: "http://localhost:6006" },
      },
    });

    await runProfileCommand(["list"], ctx);
    const out = logCalls(ctx.logSpy);
    expect(out).toContain("current");
    expect(out).toContain("auth");
    // Active row carries the asterisk
    const lines = out.split("\n");
    const prodLine = lines.find((l) => l.includes("prod"));
    expect(prodLine).toBeDefined();
    expect(prodLine).toContain("*");
    // Inactive row does not
    const devLine = lines.find((l) => l.includes("dev"));
    expect(devLine).toBeDefined();
    expect(devLine!.split("│")[1]?.trim()).toBe("");
  });
});
