import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  expectTypeOf,
  it,
} from "vitest";

import {
  DEFAULT_SETTINGS_FILE,
  SettingsFileError,
  getActiveProfile,
  getConfigDir,
  getProfile,
  getSettingsPath,
  loadSettings,
  parseSettingsFile,
  type ProfileEntry,
  type SettingsFile,
  saveSettings,
  validateProfileName,
} from "../src/settings";

// ---------------------------------------------------------------------------
// Compile-time schema shape assertions
// ---------------------------------------------------------------------------

// ProfileEntry has apiKey field (canonical schema)
expectTypeOf<ProfileEntry>().toHaveProperty("apiKey");
// ProfileEntry has no permissions field
expectTypeOf<ProfileEntry>().not.toHaveProperty("permissions");

// SettingsFile has optional $schema
expectTypeOf<SettingsFile>().toHaveProperty("$schema");
// SettingsFile has no version or defaultPermissions
expectTypeOf<SettingsFile>().not.toHaveProperty("version");
expectTypeOf<SettingsFile>().not.toHaveProperty("defaultPermissions");

// ---------------------------------------------------------------------------
// parseSettingsFile
// ---------------------------------------------------------------------------

describe("parseSettingsFile", () => {
  it("returns ok=false for invalid JSON", () => {
    const result = parseSettingsFile("not-json{");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toMatch(/Invalid JSON/i);
    }
  });

  it("returns ok=false for JSON array", () => {
    const result = parseSettingsFile("[]");
    expect(result.ok).toBe(false);
  });

  it("returns ok=false for JSON null", () => {
    const result = parseSettingsFile("null");
    expect(result.ok).toBe(false);
  });

  it("returns ok=false for JSON string primitive", () => {
    const result = parseSettingsFile('"hello"');
    expect(result.ok).toBe(false);
  });

  it("returns ok=false when activeProfile is a number", () => {
    const raw = JSON.stringify({ activeProfile: 42, profiles: {} });
    const result = parseSettingsFile(raw);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toMatch(/activeProfile/);
    }
  });

  it("returns ok=false when profiles is an array", () => {
    const raw = JSON.stringify({ activeProfile: null, profiles: [] });
    const result = parseSettingsFile(raw);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toMatch(/profiles/);
    }
  });

  it("returns ok=false when a profile entry is not an object", () => {
    const raw = JSON.stringify({
      activeProfile: null,
      profiles: { prod: "not-an-object" },
    });
    const result = parseSettingsFile(raw);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toMatch(/"prod"/);
    }
  });

  it("returns ok=false when a profile field has wrong type", () => {
    const raw = JSON.stringify({
      activeProfile: null,
      profiles: { prod: { endpoint: 42 } },
    });
    const result = parseSettingsFile(raw);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toMatch(/"prod"\.endpoint/);
    }
  });

  it("returns ok=false when headers value is not a string", () => {
    const raw = JSON.stringify({
      activeProfile: null,
      profiles: { prod: { headers: { "X-Key": 123 } } },
    });
    const result = parseSettingsFile(raw);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toMatch(/headers\["X-Key"\]/);
    }
  });

  it("returns ok=false when headers is an array", () => {
    const raw = JSON.stringify({
      activeProfile: null,
      profiles: { prod: { headers: ["a", "b"] } },
    });
    const result = parseSettingsFile(raw);
    expect(result.ok).toBe(false);
  });

  it("silently strips unknown fields from profile entries (default strip mode)", () => {
    const raw = JSON.stringify({
      activeProfile: null,
      profiles: {
        prod: { unknown_field: "oops", endpoint: "https://prod.example.com" },
      },
    });
    const result = parseSettingsFile(raw);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.profiles.prod).toEqual({
        endpoint: "https://prod.example.com",
      });
      expect("unknown_field" in result.data.profiles.prod).toBe(false);
    }
  });

  it("returns ok=true for minimal valid file", () => {
    const raw = JSON.stringify({ activeProfile: null, profiles: {} });
    const result = parseSettingsFile(raw);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.activeProfile).toBeNull();
      expect(result.data.profiles).toEqual({});
    }
  });

  it("returns ok=true with activeProfile set to a string", () => {
    const raw = JSON.stringify({
      activeProfile: "prod",
      profiles: { prod: { endpoint: "https://prod.example.com" } },
    });
    const result = parseSettingsFile(raw);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.activeProfile).toBe("prod");
      expect(result.data.profiles.prod.endpoint).toBe(
        "https://prod.example.com"
      );
    }
  });

  it("returns ok=true for profile with all optional fields including apiKey", () => {
    const raw = JSON.stringify({
      activeProfile: "full",
      profiles: {
        full: {
          endpoint: "https://example.com",
          apiKey: "my-secret-key",
          project: "my-project",
          headers: { Authorization: "Bearer token" },
        },
      },
    });
    const result = parseSettingsFile(raw);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const entry = result.data.profiles.full;
      expect(entry.endpoint).toBe("https://example.com");
      expect(entry.apiKey).toBe("my-secret-key");
      expect(entry.project).toBe("my-project");
      expect(entry.headers).toEqual({ Authorization: "Bearer token" });
    }
  });

  it("returns ok=true for profile with empty headers object", () => {
    const raw = JSON.stringify({
      activeProfile: null,
      profiles: { dev: { headers: {} } },
    });
    const result = parseSettingsFile(raw);
    expect(result.ok).toBe(true);
  });

  it("returns ok=true for profile with only some fields set", () => {
    const raw = JSON.stringify({
      activeProfile: null,
      profiles: { partial: { project: "my-project" } },
    });
    const result = parseSettingsFile(raw);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.profiles.partial.project).toBe("my-project");
      expect(result.data.profiles.partial.endpoint).toBeUndefined();
    }
  });

  it("returns ok=true for multiple profiles", () => {
    const raw = JSON.stringify({
      activeProfile: "staging",
      profiles: {
        dev: { endpoint: "http://localhost:6006" },
        staging: { endpoint: "https://staging.example.com" },
        prod: { endpoint: "https://prod.example.com" },
      },
    });
    const result = parseSettingsFile(raw);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(Object.keys(result.data.profiles)).toHaveLength(3);
      expect(result.data.activeProfile).toBe("staging");
    }
  });

  it("accepts $schema at file root", () => {
    const raw = JSON.stringify({
      $schema:
        "https://raw.githubusercontent.com/Arize-ai/phoenix/v1.0.0/schemas/phoenix-cli-settings.json",
      activeProfile: null,
      profiles: {},
    });
    const result = parseSettingsFile(raw);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.$schema).toContain("phoenix-cli-settings.json");
    }
  });

  it("accepts file without $schema (optional)", () => {
    const raw = JSON.stringify({ activeProfile: null, profiles: {} });
    const result = parseSettingsFile(raw);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.$schema).toBeUndefined();
    }
  });

  it("does not require version field (canonical schema has no version)", () => {
    const raw = JSON.stringify({ activeProfile: null, profiles: {} });
    const result = parseSettingsFile(raw);
    expect(result.ok).toBe(true);
  });

  it("silently strips version field when present (legacy data)", () => {
    const raw = JSON.stringify({
      version: 1,
      activeProfile: null,
      profiles: {},
    });
    const result = parseSettingsFile(raw);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).not.toHaveProperty("version");
    }
  });
});

// ---------------------------------------------------------------------------
// validateProfileName
// ---------------------------------------------------------------------------

describe("validateProfileName", () => {
  it("accepts lowercase alphanumeric", () => {
    expect(validateProfileName("prod")).toBe(true);
  });

  it("accepts uppercase alphanumeric", () => {
    expect(validateProfileName("PROD")).toBe(true);
  });

  it("accepts mixed case with numbers", () => {
    expect(validateProfileName("MyProfile1")).toBe(true);
  });

  it("accepts hyphens", () => {
    expect(validateProfileName("my-profile")).toBe(true);
  });

  it("accepts underscores", () => {
    expect(validateProfileName("my_profile")).toBe(true);
  });

  it("accepts hyphens and underscores combined", () => {
    expect(validateProfileName("my-profile_v2")).toBe(true);
  });

  it("rejects empty string", () => {
    expect(validateProfileName("")).toBe(false);
  });

  it("rejects string with leading space", () => {
    expect(validateProfileName(" prod")).toBe(false);
  });

  it("rejects string with trailing space", () => {
    expect(validateProfileName("prod ")).toBe(false);
  });

  it("rejects string with internal space", () => {
    expect(validateProfileName("my profile")).toBe(false);
  });

  it("rejects dots", () => {
    expect(validateProfileName("my.profile")).toBe(false);
  });

  it("rejects slashes", () => {
    expect(validateProfileName("my/profile")).toBe(false);
  });

  it("rejects at-sign", () => {
    expect(validateProfileName("my@profile")).toBe(false);
  });

  it("rejects colons", () => {
    expect(validateProfileName("my:profile")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getActiveProfile
// ---------------------------------------------------------------------------

describe("getActiveProfile", () => {
  const devEntry: ProfileEntry = { endpoint: "http://localhost:6006" };
  const prodEntry: ProfileEntry = {
    endpoint: "https://prod.example.com",
  };

  const file: SettingsFile = {
    activeProfile: "dev",
    profiles: { dev: devEntry, prod: prodEntry },
  };

  it("returns { name, entry } when overrideName is provided and exists", () => {
    const result = getActiveProfile(file, "prod");
    expect(result).toEqual({ name: "prod", entry: prodEntry });
    expect(result?.entry).toBe(prodEntry);
  });

  it("returns undefined when overrideName is provided but does not exist", () => {
    const result = getActiveProfile(file, "nonexistent");
    expect(result).toBeUndefined();
  });

  it("returns { name, entry } for the activeProfile when no override", () => {
    const result = getActiveProfile(file);
    expect(result).toEqual({ name: "dev", entry: devEntry });
    expect(result?.entry).toBe(devEntry);
  });

  it("returns undefined when activeProfile is null and no override", () => {
    const noActive: SettingsFile = { ...file, activeProfile: null };
    const result = getActiveProfile(noActive);
    expect(result).toBeUndefined();
  });

  it("returns undefined when activeProfile points to a nonexistent entry", () => {
    const missing: SettingsFile = { ...file, activeProfile: "missing" };
    const result = getActiveProfile(missing);
    expect(result).toBeUndefined();
  });

  it("override takes precedence over activeProfile", () => {
    const result = getActiveProfile(file, "prod");
    expect(result?.name).toBe("prod");
    expect(result?.entry).toBe(prodEntry);
  });

  it("returns undefined on empty profiles with no active", () => {
    const empty: SettingsFile = { activeProfile: null, profiles: {} };
    expect(getActiveProfile(empty)).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// getProfile
// ---------------------------------------------------------------------------

describe("getProfile", () => {
  const devEntry: ProfileEntry = { endpoint: "http://localhost:6006" };
  const file: SettingsFile = {
    activeProfile: null,
    profiles: { dev: devEntry },
  };

  it("returns the profile entry when found", () => {
    expect(getProfile(file, "dev")).toBe(devEntry);
  });

  it("returns undefined for an unknown profile name", () => {
    expect(getProfile(file, "nonexistent")).toBeUndefined();
  });

  it("returns undefined on empty profiles", () => {
    const empty: SettingsFile = { activeProfile: null, profiles: {} };
    expect(getProfile(empty, "dev")).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// getConfigDir / getSettingsPath
// ---------------------------------------------------------------------------

describe("getConfigDir", () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("falls back to ~/.px when XDG_CONFIG_HOME is unset", () => {
    delete process.env.XDG_CONFIG_HOME;
    const dir = getConfigDir();
    expect(dir).toBe(path.join(os.homedir(), ".px"));
  });

  it("uses XDG_CONFIG_HOME when set", () => {
    process.env.XDG_CONFIG_HOME = "/custom/xdg";
    const dir = getConfigDir();
    expect(dir).toBe("/custom/xdg/px");
  });
});

describe("getSettingsPath", () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("returns path ending in settings.json within getConfigDir()", () => {
    delete process.env.XDG_CONFIG_HOME;
    const p = getSettingsPath();
    expect(p).toBe(path.join(os.homedir(), ".px", "settings.json"));
  });

  it("respects XDG_CONFIG_HOME for the settings path", () => {
    process.env.XDG_CONFIG_HOME = "/custom/xdg";
    expect(getSettingsPath()).toBe("/custom/xdg/px/settings.json");
  });

  it("does not reference profiles.json", () => {
    delete process.env.XDG_CONFIG_HOME;
    expect(getSettingsPath()).not.toContain("profiles.json");
  });
});

// ---------------------------------------------------------------------------
// loadSettings / saveSettings (I/O tests using a temp directory)
// ---------------------------------------------------------------------------

describe("loadSettings / saveSettings", () => {
  let tmpDir: string;
  let settingsPath: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "phoenix-settings-test-"));
    settingsPath = path.join(tmpDir, "settings.json");
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  // --- loadSettings: missing file ---

  it("returns DEFAULT_SETTINGS_FILE when file does not exist (forgiving)", () => {
    const result = loadSettings({ settingsPath });
    expect(result).toEqual(DEFAULT_SETTINGS_FILE);
  });

  it("returns DEFAULT_SETTINGS_FILE when file does not exist (strict)", () => {
    // ENOENT is always forgiving regardless of strict
    const result = loadSettings({ strict: true, settingsPath });
    expect(result).toEqual(DEFAULT_SETTINGS_FILE);
  });

  it("never reads profiles.json even when present on disk", () => {
    const profilesPath = path.join(tmpDir, "profiles.json");
    fs.writeFileSync(
      profilesPath,
      JSON.stringify({ activeProfile: "old", profiles: { old: {} } }),
      "utf-8"
    );
    // loadSettings with settingsPath pointing to non-existent settings.json
    const result = loadSettings({ settingsPath });
    expect(result).toEqual(DEFAULT_SETTINGS_FILE);
    expect(result.activeProfile).toBeNull();
  });

  // --- loadSettings: malformed file, forgiving mode ---

  it("returns DEFAULT_SETTINGS_FILE and warns to stderr for invalid JSON (forgiving)", () => {
    fs.writeFileSync(settingsPath, "not-json", "utf-8");
    const stderrChunks: string[] = [];
    const originalWrite = process.stderr.write.bind(process.stderr);
    process.stderr.write = (chunk: unknown) => {
      stderrChunks.push(String(chunk));
      return true;
    };
    try {
      const result = loadSettings({ settingsPath });
      expect(result).toEqual(DEFAULT_SETTINGS_FILE);
      expect(stderrChunks.join("")).toMatch(/Warning/i);
    } finally {
      process.stderr.write = originalWrite;
    }
  });

  // --- loadSettings: malformed file, strict mode ---

  it("throws SettingsFileError for invalid JSON (strict)", () => {
    fs.writeFileSync(settingsPath, "not-json", "utf-8");
    expect(() => loadSettings({ strict: true, settingsPath })).toThrow(
      SettingsFileError
    );
  });

  it("throws SettingsFileError for corrupt profile entry (strict)", () => {
    fs.writeFileSync(
      settingsPath,
      JSON.stringify({
        activeProfile: null,
        profiles: { bad: "not-an-object" },
      }),
      "utf-8"
    );
    expect(() => loadSettings({ strict: true, settingsPath })).toThrow(
      SettingsFileError
    );
  });

  // --- loadSettings: valid file ---

  it("loads a valid settings file from disk", () => {
    const data: SettingsFile = {
      activeProfile: "dev",
      profiles: {
        dev: { endpoint: "http://localhost:6006", project: "dev-project" },
      },
    };
    fs.writeFileSync(settingsPath, JSON.stringify(data, null, 2), "utf-8");

    const result = loadSettings({ settingsPath });
    expect(result.activeProfile).toBe("dev");
    expect(result.profiles.dev.endpoint).toBe("http://localhost:6006");
    expect(result.profiles.dev.project).toBe("dev-project");
  });

  it("loads a file with apiKey in profile", () => {
    const data: SettingsFile = {
      activeProfile: "prod",
      profiles: {
        prod: { endpoint: "https://prod.example.com", apiKey: "secret-key" },
      },
    };
    fs.writeFileSync(settingsPath, JSON.stringify(data, null, 2), "utf-8");

    const result = loadSettings({ settingsPath });
    expect(result.profiles.prod.apiKey).toBe("secret-key");
  });

  it("loads a file with multiple profiles", () => {
    const data: SettingsFile = {
      activeProfile: "staging",
      profiles: {
        dev: { endpoint: "http://localhost:6006" },
        staging: { endpoint: "https://staging.example.com" },
        prod: { endpoint: "https://prod.example.com" },
      },
    };
    fs.writeFileSync(settingsPath, JSON.stringify(data, null, 2), "utf-8");

    const result = loadSettings({ settingsPath });
    expect(Object.keys(result.profiles)).toHaveLength(3);
    expect(result.activeProfile).toBe("staging");
  });

  // --- saveSettings ---

  it("writes valid JSON to the specified path", () => {
    const data: SettingsFile = {
      activeProfile: null,
      profiles: { dev: { endpoint: "http://localhost:6006" } },
    };
    saveSettings(data, { settingsPath });

    const raw = fs.readFileSync(settingsPath, "utf-8");
    const parsed = JSON.parse(raw);
    expect(parsed.profiles.dev.endpoint).toBe("http://localhost:6006");
  });

  it("writes human-readable JSON (2-space indent)", () => {
    const data: SettingsFile = {
      activeProfile: null,
      profiles: { dev: { endpoint: "http://localhost:6006" } },
    };
    saveSettings(data, { settingsPath });

    const raw = fs.readFileSync(settingsPath, "utf-8");
    expect(raw).toContain("  ");
    expect(raw.endsWith("\n")).toBe(true);
  });

  it("writes file with mode 0o600 (owner read/write only)", () => {
    const data: SettingsFile = {
      activeProfile: null,
      profiles: { dev: { endpoint: "http://localhost:6006" } },
    };
    saveSettings(data, { settingsPath });

    const stat = fs.statSync(settingsPath);
    expect(stat.mode & 0o777).toBe(0o600);
  });

  it("creates parent directories if they do not exist", () => {
    const nestedPath = path.join(tmpDir, "nested", "deep", "settings.json");
    const data: SettingsFile = { activeProfile: null, profiles: {} };
    saveSettings(data, { settingsPath: nestedPath });
    expect(fs.existsSync(nestedPath)).toBe(true);
  });

  // --- round-trip: saveSettings then loadSettings ---

  it("round-trips: save then load returns identical data", () => {
    const data: SettingsFile = {
      activeProfile: "prod",
      profiles: {
        dev: {
          endpoint: "http://localhost:6006",
          project: "dev-project",
          headers: { "X-Custom": "value" },
        },
        prod: {
          endpoint: "https://prod.example.com",
          apiKey: "prod-key",
        },
      },
    };

    saveSettings(data, { settingsPath });
    const loaded = loadSettings({ settingsPath });

    expect(loaded).toEqual(data);
  });

  it("round-trip preserves null activeProfile", () => {
    const data: SettingsFile = { activeProfile: null, profiles: {} };
    saveSettings(data, { settingsPath });
    const loaded = loadSettings({ settingsPath });
    expect(loaded.activeProfile).toBeNull();
  });

  it("overwrites an existing file on save", () => {
    const first: SettingsFile = {
      activeProfile: null,
      profiles: { dev: { endpoint: "http://localhost:6006" } },
    };
    saveSettings(first, { settingsPath });

    const second: SettingsFile = {
      activeProfile: "prod",
      profiles: { prod: { endpoint: "https://prod.example.com" } },
    };
    saveSettings(second, { settingsPath });

    const loaded = loadSettings({ settingsPath });
    expect(loaded).toEqual(second);
    expect(loaded.profiles.dev).toBeUndefined();
  });
});
