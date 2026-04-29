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

// ---------------------------------------------------------------------------
// px profile list
// ---------------------------------------------------------------------------

describe("px profile list", () => {
  let tmpDir: string;
  let originalEnv: NodeJS.ProcessEnv;
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let exitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    originalEnv = { ...process.env };
    delete process.env.PHOENIX_HOST;
    delete process.env.PHOENIX_API_KEY;
    delete process.env.PHOENIX_PROFILE;

    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "phoenix-profile-test-"));
    process.env.XDG_CONFIG_HOME = tmpDir;

    logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    exitSpy = vi
      .spyOn(process, "exit")
      .mockImplementation((_code?: number | string) => {
        throw new Error(`process.exit(${_code})`);
      });
  });

  afterEach(() => {
    process.env = originalEnv;
    fs.rmSync(tmpDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it("outputs 'No profiles found' when no profiles exist", async () => {
    await runProfileCommand(["list"], { logSpy, errorSpy, exitSpy });
    const output = logSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(output).toContain("No profiles found");
  });

  it("shows existing profiles in pretty format by default", async () => {
    writeTempSettings(tmpDir, {
      activeProfile: "dev",
      profiles: {
        dev: { endpoint: "http://localhost:6006" },
        prod: { endpoint: "https://prod.example.com" },
      },
    });

    await runProfileCommand(["list"], { logSpy, errorSpy, exitSpy });

    const output = logSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(output).toContain("dev");
    expect(output).toContain("prod");
    expect(output).toContain("http://localhost:6006");
    expect(output).toContain("https://prod.example.com");
  });

  it("marks the active profile with an asterisk in pretty format", async () => {
    writeTempSettings(tmpDir, {
      activeProfile: "dev",
      profiles: {
        dev: { endpoint: "http://localhost:6006" },
        prod: { endpoint: "https://prod.example.com" },
      },
    });

    await runProfileCommand(["list"], { logSpy, errorSpy, exitSpy });

    const output = logSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(output).toContain("*");
  });

  it("--format json outputs valid JSON with profiles array", async () => {
    writeTempSettings(tmpDir, {
      activeProfile: "dev",
      profiles: { dev: { endpoint: "http://localhost:6006" } },
    });

    await runProfileCommand(["list", "--format", "json"], {
      logSpy,
      errorSpy,
      exitSpy,
    });

    const output = logSpy.mock.calls.map((c) => String(c[0])).join("\n");
    const parsed = JSON.parse(output);
    expect(parsed).toHaveProperty("profiles");
    expect(Array.isArray(parsed.profiles)).toBe(true);
    expect(parsed.profiles[0].name).toBe("dev");
    expect(parsed.profiles[0]).not.toHaveProperty("apiKey");
  });

  it("--format raw outputs one JSON object per line", async () => {
    writeTempSettings(tmpDir, {
      activeProfile: null,
      profiles: {
        dev: { endpoint: "http://localhost:6006" },
        prod: { endpoint: "https://prod.example.com" },
      },
    });

    await runProfileCommand(["list", "--format", "raw"], {
      logSpy,
      errorSpy,
      exitSpy,
    });

    const output = logSpy.mock.calls.map((c) => String(c[0])).join("\n");
    const lines = output.trim().split("\n");
    expect(lines).toHaveLength(2);
    for (const line of lines) {
      expect(() => JSON.parse(line)).not.toThrow();
    }
  });

  it("pretty output does not contain api-key column", async () => {
    writeTempSettings(tmpDir, {
      activeProfile: null,
      profiles: { dev: { endpoint: "http://localhost:6006" } },
    });

    await runProfileCommand(["list"], { logSpy, errorSpy, exitSpy });

    const output = logSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(output).toContain("dev");
    expect(output).not.toContain("api-key");
  });
});

// ---------------------------------------------------------------------------
// px profile create
// ---------------------------------------------------------------------------

describe("px profile create", () => {
  let tmpDir: string;
  let originalEnv: NodeJS.ProcessEnv;
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let exitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    originalEnv = { ...process.env };
    delete process.env.PHOENIX_HOST;
    delete process.env.PHOENIX_API_KEY;
    delete process.env.PHOENIX_PROFILE;

    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "phoenix-profile-test-"));
    process.env.XDG_CONFIG_HOME = tmpDir;

    logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    exitSpy = vi
      .spyOn(process, "exit")
      .mockImplementation((_code?: number | string) => {
        throw new Error(`process.exit(${_code})`);
      });
  });

  afterEach(() => {
    process.env = originalEnv;
    fs.rmSync(tmpDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it("adds a new profile and writes it to disk", async () => {
    await runProfileCommand(
      ["create", "staging", "--endpoint", "https://staging.example.com"],
      { logSpy, errorSpy, exitSpy }
    );

    const output = logSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(output).toContain("staging");
    expect(output).toContain("https://staging.example.com");

    const settingsPath = path.join(tmpDir, "px", "settings.json");
    const data: SettingsFile = JSON.parse(
      fs.readFileSync(settingsPath, "utf-8")
    );
    expect(data.profiles.staging).toBeDefined();
    expect(data.profiles.staging.endpoint).toBe("https://staging.example.com");
  });

  it("--current sets the profile as active", async () => {
    await runProfileCommand(
      ["create", "prod", "--endpoint", "https://prod.example.com", "--current"],
      { logSpy, errorSpy, exitSpy }
    );

    const settingsPath = path.join(tmpDir, "px", "settings.json");
    const data: SettingsFile = JSON.parse(
      fs.readFileSync(settingsPath, "utf-8")
    );
    expect(data.activeProfile).toBe("prod");

    const output = logSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(output).toContain("prod");
    expect(output).toContain("https://prod.example.com");
  });

  it("--project stores the project field", async () => {
    await runProfileCommand(
      [
        "create",
        "dev",
        "--endpoint",
        "http://localhost:6006",
        "--project",
        "my-project",
      ],
      { logSpy, errorSpy, exitSpy }
    );

    const settingsPath = path.join(tmpDir, "px", "settings.json");
    const data: SettingsFile = JSON.parse(
      fs.readFileSync(settingsPath, "utf-8")
    );
    expect(data.profiles.dev.project).toBe("my-project");
  });

  it("exits with error for non-URL endpoint", async () => {
    await expect(
      runProfileCommand(["create", "staging", "--endpoint", "not-a-url"], {
        logSpy,
        errorSpy,
        exitSpy,
      })
    ).rejects.toThrow();

    const errOutput = errorSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(errOutput).toMatch(/Invalid endpoint/i);
    expect(errOutput).toContain("not-a-url");
  });

  it("exits with error for invalid profile name", async () => {
    await expect(
      runProfileCommand(
        ["create", "my profile!", "--endpoint", "http://localhost:6006"],
        { logSpy, errorSpy, exitSpy }
      )
    ).rejects.toThrow();

    const errOutput = errorSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(errOutput).toContain("Invalid profile name");
  });

  it("exits with error when profile already exists", async () => {
    writeTempSettings(tmpDir, {
      activeProfile: null,
      profiles: { dev: { endpoint: "http://localhost:6006" } },
    });

    await expect(
      runProfileCommand(["create", "dev", "--endpoint", "http://other:6006"], {
        logSpy,
        errorSpy,
        exitSpy,
      })
    ).rejects.toThrow();

    const errOutput = errorSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(errOutput).toContain('"dev" already exists');
  });

  it("exits with error on corrupt profiles file (strict mode)", async () => {
    const pxDir = path.join(tmpDir, "px");
    fs.mkdirSync(pxDir, { recursive: true });
    fs.writeFileSync(
      path.join(pxDir, "settings.json"),
      "not-valid-json",
      "utf-8"
    );

    await expect(
      runProfileCommand(
        ["create", "dev", "--endpoint", "http://localhost:6006"],
        { logSpy, errorSpy, exitSpy }
      )
    ).rejects.toThrow();

    const errOutput = errorSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(errOutput).toContain("Error reading settings file");
  });
});

// ---------------------------------------------------------------------------
// px profile use
// ---------------------------------------------------------------------------

describe("px profile use", () => {
  let tmpDir: string;
  let originalEnv: NodeJS.ProcessEnv;
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let exitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    originalEnv = { ...process.env };
    delete process.env.PHOENIX_HOST;
    delete process.env.PHOENIX_API_KEY;
    delete process.env.PHOENIX_PROFILE;

    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "phoenix-profile-test-"));
    process.env.XDG_CONFIG_HOME = tmpDir;

    logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    exitSpy = vi
      .spyOn(process, "exit")
      .mockImplementation((_code?: number | string) => {
        throw new Error(`process.exit(${_code})`);
      });
  });

  afterEach(() => {
    process.env = originalEnv;
    fs.rmSync(tmpDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it("sets the active profile and prints confirmation", async () => {
    writeTempSettings(tmpDir, {
      activeProfile: "dev",
      profiles: {
        dev: { endpoint: "http://localhost:6006" },
        prod: { endpoint: "https://prod.example.com" },
      },
    });

    await runProfileCommand(["use", "prod"], { logSpy, errorSpy, exitSpy });

    const output = logSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(output).toContain("prod");
    expect(output).toContain("https://prod.example.com");

    const settingsPath = path.join(tmpDir, "px", "settings.json");
    const data: SettingsFile = JSON.parse(
      fs.readFileSync(settingsPath, "utf-8")
    );
    expect(data.activeProfile).toBe("prod");
  });

  it("exits with error when the named profile does not exist", async () => {
    writeTempSettings(tmpDir, {
      activeProfile: null,
      profiles: { dev: { endpoint: "http://localhost:6006" } },
    });

    await expect(
      runProfileCommand(["use", "nonexistent"], { logSpy, errorSpy, exitSpy })
    ).rejects.toThrow();

    const errOutput = errorSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(errOutput).toContain('"nonexistent" does not exist');
  });

  it("sets from no active profile to a named profile", async () => {
    writeTempSettings(tmpDir, {
      activeProfile: null,
      profiles: { staging: { endpoint: "https://staging.example.com" } },
    });

    await runProfileCommand(["use", "staging"], {
      logSpy,
      errorSpy,
      exitSpy,
    });

    const settingsPath = path.join(tmpDir, "px", "settings.json");
    const data: SettingsFile = JSON.parse(
      fs.readFileSync(settingsPath, "utf-8")
    );
    expect(data.activeProfile).toBe("staging");
  });

  it("exits with error on corrupt profiles file (strict mode)", async () => {
    const pxDir = path.join(tmpDir, "px");
    fs.mkdirSync(pxDir, { recursive: true });
    fs.writeFileSync(path.join(pxDir, "settings.json"), "not-json", "utf-8");

    await expect(
      runProfileCommand(["use", "dev"], { logSpy, errorSpy, exitSpy })
    ).rejects.toThrow();

    const errOutput = errorSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(errOutput).toContain("Error reading settings file");
  });
});

// ---------------------------------------------------------------------------
// px profile show
// ---------------------------------------------------------------------------

describe("px profile show", () => {
  let tmpDir: string;
  let originalEnv: NodeJS.ProcessEnv;
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let exitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    originalEnv = { ...process.env };
    delete process.env.PHOENIX_HOST;
    delete process.env.PHOENIX_API_KEY;
    delete process.env.PHOENIX_PROFILE;

    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "phoenix-profile-test-"));
    process.env.XDG_CONFIG_HOME = tmpDir;

    logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    exitSpy = vi
      .spyOn(process, "exit")
      .mockImplementation((_code?: number | string) => {
        throw new Error(`process.exit(${_code})`);
      });
  });

  afterEach(() => {
    process.env = originalEnv;
    fs.rmSync(tmpDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it("shows a named profile", async () => {
    writeTempSettings(tmpDir, {
      activeProfile: null,
      profiles: { prod: { endpoint: "https://prod.example.com" } },
    });

    await runProfileCommand(["show", "prod"], { logSpy, errorSpy, exitSpy });

    const output = logSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(output).toContain("prod");
    expect(output).toContain("https://prod.example.com");
  });

  it("shows the active profile when no name is given", async () => {
    writeTempSettings(tmpDir, {
      activeProfile: "dev",
      profiles: {
        dev: { endpoint: "http://localhost:6006" },
        prod: { endpoint: "https://prod.example.com" },
      },
    });

    await runProfileCommand(["show"], { logSpy, errorSpy, exitSpy });

    const output = logSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(output).toContain("dev");
    expect(output).toContain("http://localhost:6006");
  });

  it("exits with error when named profile does not exist", async () => {
    writeTempSettings(tmpDir, {
      activeProfile: null,
      profiles: {},
    });

    await expect(
      runProfileCommand(["show", "nonexistent"], { logSpy, errorSpy, exitSpy })
    ).rejects.toThrow();

    const errOutput = errorSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(errOutput).toContain('"nonexistent"');
  });

  it("exits with error when no active profile and no name given", async () => {
    writeTempSettings(tmpDir, {
      activeProfile: null,
      profiles: {},
    });

    await expect(
      runProfileCommand(["show"], { logSpy, errorSpy, exitSpy })
    ).rejects.toThrow();

    const errOutput = errorSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(errOutput).toContain("No active profile");
  });
});

// ---------------------------------------------------------------------------
// px profile delete
// ---------------------------------------------------------------------------

describe("px profile delete", () => {
  let tmpDir: string;
  let originalEnv: NodeJS.ProcessEnv;
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let exitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    originalEnv = { ...process.env };
    delete process.env.PHOENIX_HOST;
    delete process.env.PHOENIX_API_KEY;
    delete process.env.PHOENIX_PROFILE;

    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "phoenix-profile-test-"));
    process.env.XDG_CONFIG_HOME = tmpDir;

    logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    exitSpy = vi
      .spyOn(process, "exit")
      .mockImplementation((_code?: number | string) => {
        throw new Error(`process.exit(${_code})`);
      });
  });

  afterEach(() => {
    process.env = originalEnv;
    fs.rmSync(tmpDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it("removes an existing profile from disk", async () => {
    writeTempSettings(tmpDir, {
      activeProfile: null,
      profiles: {
        dev: { endpoint: "http://localhost:6006" },
        prod: { endpoint: "https://prod.example.com" },
      },
    });

    await runProfileCommand(["delete", "dev", "--yes"], {
      logSpy,
      errorSpy,
      exitSpy,
    });

    const output = logSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(output).toContain("dev");

    const settingsPath = path.join(tmpDir, "px", "settings.json");
    const data: SettingsFile = JSON.parse(
      fs.readFileSync(settingsPath, "utf-8")
    );
    expect(data.profiles.dev).toBeUndefined();
    expect(data.profiles.prod).toBeDefined();
  });

  it("clears activeProfile when the active profile is deleted", async () => {
    writeTempSettings(tmpDir, {
      activeProfile: "dev",
      profiles: { dev: { endpoint: "http://localhost:6006" } },
    });

    await runProfileCommand(["delete", "dev", "--yes"], {
      logSpy,
      errorSpy,
      exitSpy,
    });

    const settingsPath = path.join(tmpDir, "px", "settings.json");
    const data: SettingsFile = JSON.parse(
      fs.readFileSync(settingsPath, "utf-8")
    );
    expect(data.activeProfile).toBeNull();

    const errOutput = errorSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(errOutput).toContain("Warning");
    expect(errOutput).toContain("stored default profile");
  });

  it("exits with error when profile does not exist", async () => {
    await expect(
      runProfileCommand(["delete", "nonexistent", "--yes"], {
        logSpy,
        errorSpy,
        exitSpy,
      })
    ).rejects.toThrow();

    const errOutput = errorSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(errOutput).toContain('"nonexistent" does not exist');
  });
});

// ---------------------------------------------------------------------------
// px profile edit (mocked editor)
// ---------------------------------------------------------------------------

describe("px profile edit", () => {
  let tmpDir: string;
  let originalEnv: NodeJS.ProcessEnv;
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let exitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    originalEnv = { ...process.env };
    delete process.env.PHOENIX_HOST;
    delete process.env.PHOENIX_API_KEY;
    delete process.env.PHOENIX_PROFILE;

    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "phoenix-profile-test-"));
    process.env.XDG_CONFIG_HOME = tmpDir;

    logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    exitSpy = vi
      .spyOn(process, "exit")
      .mockImplementation((_code?: number | string) => {
        throw new Error(`process.exit(${_code})`);
      });
  });

  afterEach(() => {
    process.env = originalEnv;
    fs.rmSync(tmpDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it("happy path: editor writes valid JSON, profile is persisted", async () => {
    writeTempSettings(tmpDir, {
      activeProfile: null,
      profiles: { dev: { endpoint: "http://localhost:6006" } },
    });

    // profileEditHandler accepts runEditor as its third argument via .action().
    // We test via a thin shell script set as PHOENIX_EDITOR that patches the file.
    const editorScript = path.join(tmpDir, "editor.sh");
    fs.writeFileSync(
      editorScript,
      `#!/bin/sh\nprintf '{"endpoint":"http://patched:6006"}' > "$1"\n`,
      { mode: 0o755 }
    );
    process.env.PHOENIX_EDITOR = editorScript;

    await runProfileCommand(["edit", "dev"], { logSpy, errorSpy, exitSpy });

    const settingsPath = path.join(tmpDir, "px", "settings.json");
    const data: SettingsFile = JSON.parse(
      fs.readFileSync(settingsPath, "utf-8")
    );
    expect(data.profiles.dev.endpoint).toBe("http://patched:6006");

    const output = logSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(output).toContain("dev");
  });

  it("re-prompt loop: invalid JSON on first edit, fixed on second", async () => {
    writeTempSettings(tmpDir, {
      activeProfile: null,
      profiles: { dev: { endpoint: "http://localhost:6006" } },
    });

    let callCount = 0;
    const editorScript = path.join(tmpDir, "editor.sh");

    // First call writes invalid JSON, second call writes valid JSON
    const firstScript = path.join(tmpDir, "editor-first.sh");
    const secondScript = path.join(tmpDir, "editor-second.sh");
    fs.writeFileSync(firstScript, `#!/bin/sh\nprintf 'not-json' > "$1"\n`, {
      mode: 0o755,
    });
    fs.writeFileSync(
      secondScript,
      `#!/bin/sh\nprintf '{"endpoint":"http://fixed:6006"}' > "$1"\n`,
      { mode: 0o755 }
    );

    const dispatchScript = path.join(tmpDir, "editor-dispatch.sh");
    fs.writeFileSync(
      dispatchScript,
      `#!/bin/sh\nCOUNT_FILE="${tmpDir}/count"\nCOUNT=$(cat "$COUNT_FILE" 2>/dev/null || echo 0)\nif [ "$COUNT" = "0" ]; then\n  printf 'not-json' > "$1"\nelse\n  printf '{"endpoint":"http://fixed:6006"}' > "$1"\nfi\necho $((COUNT+1)) > "$COUNT_FILE"\n`,
      { mode: 0o755 }
    );
    process.env.PHOENIX_EDITOR = dispatchScript;

    await runProfileCommand(["edit", "dev"], { logSpy, errorSpy, exitSpy });

    const settingsPath = path.join(tmpDir, "px", "settings.json");
    const data: SettingsFile = JSON.parse(
      fs.readFileSync(settingsPath, "utf-8")
    );
    expect(data.profiles.dev.endpoint).toBe("http://fixed:6006");

    const errOutput = errorSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(errOutput).toContain("Re-opening editor");
  });

  it("exits with error when profile does not exist", async () => {
    writeTempSettings(tmpDir, {
      activeProfile: null,
      profiles: {},
    });

    process.env.PHOENIX_EDITOR = "true"; // no-op editor

    await expect(
      runProfileCommand(["edit", "nonexistent"], {
        logSpy,
        errorSpy,
        exitSpy,
      })
    ).rejects.toThrow();

    const errOutput = errorSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(errOutput).toContain('"nonexistent" does not exist');
  });
});

// ---------------------------------------------------------------------------
// End-to-end lifecycle integration (temp config dir)
// ---------------------------------------------------------------------------

describe("px profile lifecycle (end-to-end)", () => {
  let tmpDir: string;
  let originalEnv: NodeJS.ProcessEnv;
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let exitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    originalEnv = { ...process.env };
    delete process.env.PHOENIX_HOST;
    delete process.env.PHOENIX_API_KEY;
    delete process.env.PHOENIX_PROFILE;

    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "phoenix-lifecycle-test-"));
    process.env.XDG_CONFIG_HOME = tmpDir;

    logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    exitSpy = vi
      .spyOn(process, "exit")
      .mockImplementation((_code?: number | string) => {
        throw new Error(`process.exit(${_code})`);
      });
  });

  afterEach(() => {
    process.env = originalEnv;
    fs.rmSync(tmpDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it("full lifecycle: create --current → list (active) → show → create b → use b → delete a → list (no a)", async () => {
    // 1. create profile "a" as current
    await runProfileCommand(
      ["create", "a", "--endpoint", "http://alpha:6006", "--current"],
      { logSpy, errorSpy, exitSpy }
    );

    // 2. list: a is active
    logSpy.mockClear();
    await runProfileCommand(["list", "--format", "json"], {
      logSpy,
      errorSpy,
      exitSpy,
    });
    const afterCreate = JSON.parse(
      logSpy.mock.calls.map((c) => String(c[0])).join("\n")
    );
    expect(afterCreate.profiles).toHaveLength(1);
    expect(afterCreate.profiles[0].name).toBe("a");
    expect(afterCreate.profiles[0].active).toBe(true);

    // 3. show a
    logSpy.mockClear();
    await runProfileCommand(["show", "a", "--format", "json"], {
      logSpy,
      errorSpy,
      exitSpy,
    });
    const shown = JSON.parse(
      logSpy.mock.calls.map((c) => String(c[0])).join("\n")
    );
    expect(shown.name).toBe("a");
    expect(shown.endpoint).toBe("http://alpha:6006");

    // 4. create profile "b"
    await runProfileCommand(["create", "b", "--endpoint", "http://beta:6006"], {
      logSpy,
      errorSpy,
      exitSpy,
    });

    // 5. use b → b is now active
    await runProfileCommand(["use", "b"], { logSpy, errorSpy, exitSpy });
    const settingsPath = path.join(tmpDir, "px", "settings.json");
    const afterUse: SettingsFile = JSON.parse(
      fs.readFileSync(settingsPath, "utf-8")
    );
    expect(afterUse.activeProfile).toBe("b");

    // 6. delete a
    await runProfileCommand(["delete", "a", "--yes"], {
      logSpy,
      errorSpy,
      exitSpy,
    });

    // 7. list: only b remains
    logSpy.mockClear();
    await runProfileCommand(["list", "--format", "json"], {
      logSpy,
      errorSpy,
      exitSpy,
    });
    const afterDelete = JSON.parse(
      logSpy.mock.calls.map((c) => String(c[0])).join("\n")
    );
    expect(afterDelete.profiles).toHaveLength(1);
    expect(afterDelete.profiles[0].name).toBe("b");
    expect(
      afterDelete.profiles.find((p: { name: string }) => p.name === "a")
    ).toBeUndefined();
  });
});
