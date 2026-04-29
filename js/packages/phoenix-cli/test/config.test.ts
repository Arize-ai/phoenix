import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  getBuiltInDefaults,
  getConfigErrorMessage,
  loadConfigFromEnvironment,
  loadConfigFromProfile,
  type PhoenixConfig,
  resolveConfig,
  validateConfig,
} from "../src/config";
import {
  ProfileResolutionError,
  type SettingsFile,
  saveSettings,
} from "../src/settings";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Write a settings file into a temp XDG_CONFIG_HOME directory so that
 * loadConfigFromProfile() / resolveConfig() can read it without touching
 * the real ~/.px/settings.json.
 */
function writeTempSettings(tmpDir: string, data: SettingsFile): void {
  const pxConfigDir = path.join(tmpDir, "px");
  fs.mkdirSync(pxConfigDir, { recursive: true });
  const settingsPath = path.join(pxConfigDir, "settings.json");
  saveSettings(data, { settingsPath });
}

// ---------------------------------------------------------------------------
// Test setup
// ---------------------------------------------------------------------------

describe("Configuration", () => {
  let originalEnv: NodeJS.ProcessEnv;
  let tmpDir: string;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };

    // Clear all env vars that affect config resolution
    delete process.env.PHOENIX_HOST;
    delete process.env.PHOENIX_PROJECT;
    delete process.env.PHOENIX_API_KEY;
    delete process.env.PHOENIX_CLIENT_HEADERS;
    delete process.env.PHOENIX_PROFILE;

    // Create a temp dir and redirect XDG_CONFIG_HOME so profile I/O
    // stays isolated from the developer's real config directory.
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "phoenix-config-test-"));
    process.env.XDG_CONFIG_HOME = tmpDir;
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  // -------------------------------------------------------------------------
  // getBuiltInDefaults
  // -------------------------------------------------------------------------

  describe("getBuiltInDefaults", () => {
    it("should return the default endpoint", () => {
      const defaults = getBuiltInDefaults();
      expect(defaults.endpoint).toBe("http://localhost:6006");
    });
  });

  // -------------------------------------------------------------------------
  // loadConfigFromEnvironment
  // -------------------------------------------------------------------------

  describe("loadConfigFromEnvironment", () => {
    it("should load config from environment variables", () => {
      process.env.PHOENIX_HOST = "http://localhost:6006";
      process.env.PHOENIX_PROJECT = "test-project";
      process.env.PHOENIX_API_KEY = "test-key";

      const config = loadConfigFromEnvironment();

      expect(config.endpoint).toBe("http://localhost:6006");
      expect(config.project).toBe("test-project");
      expect(config.apiKey).toBe("test-key");
    });

    it("should return no endpoint when PHOENIX_HOST is not set", () => {
      const config = loadConfigFromEnvironment();

      expect(config.endpoint).toBeUndefined();
      expect(config.project).toBeUndefined();
      expect(config.apiKey).toBeUndefined();
    });

    it("should not include built-in defaults", () => {
      // After the refactor, loadConfigFromEnvironment() must NOT inject the
      // default endpoint when PHOENIX_HOST is absent — that is getBuiltInDefaults()'s job.
      const config = loadConfigFromEnvironment();
      expect(config.endpoint).toBeUndefined();
    });

    it("should load custom headers from environment", () => {
      process.env.PHOENIX_CLIENT_HEADERS = '{"X-Custom": "value"}';

      const config = loadConfigFromEnvironment();

      expect(config.headers).toEqual({ "X-Custom": "value" });
    });
  });

  // -------------------------------------------------------------------------
  // loadConfigFromProfile
  // -------------------------------------------------------------------------

  describe("loadConfigFromProfile", () => {
    it("returns empty config when no profiles file exists", () => {
      const config = loadConfigFromProfile();
      expect(config).toEqual({});
    });

    it("returns empty config when no active profile is set", () => {
      writeTempSettings(tmpDir, {
        activeProfile: null,
        profiles: { dev: { endpoint: "http://localhost:6006" } },
      });
      const config = loadConfigFromProfile();
      expect(config).toEqual({});
    });

    it("loads the active profile from the profiles file", () => {
      writeTempSettings(tmpDir, {
        activeProfile: "dev",
        profiles: {
          dev: { endpoint: "http://dev.example.com" },
        },
      });
      const config = loadConfigFromProfile();
      expect(config.endpoint).toBe("http://dev.example.com");
      expect(config.apiKey).toBeUndefined();
    });

    it("loads a profile by explicit name (--profile flag)", () => {
      writeTempSettings(tmpDir, {
        activeProfile: "dev",
        profiles: {
          dev: { endpoint: "http://dev.example.com" },
          prod: { endpoint: "https://prod.example.com" },
        },
      });
      const config = loadConfigFromProfile("prod");
      expect(config.endpoint).toBe("https://prod.example.com");
      expect(config.apiKey).toBeUndefined();
    });

    it("explicit profileName overrides activeProfile in file", () => {
      writeTempSettings(tmpDir, {
        activeProfile: "dev",
        profiles: {
          dev: { endpoint: "http://dev.example.com" },
          staging: { endpoint: "https://staging.example.com" },
        },
      });
      // activeProfile is "dev" but we explicitly request "staging"
      const config = loadConfigFromProfile("staging");
      expect(config.endpoint).toBe("https://staging.example.com");
    });

    it("loads profile via PHOENIX_PROFILE env var when no explicit name", () => {
      writeTempSettings(tmpDir, {
        activeProfile: null,
        profiles: {
          staging: { endpoint: "https://staging.example.com" },
        },
      });
      process.env.PHOENIX_PROFILE = "staging";
      const config = loadConfigFromProfile();
      expect(config.endpoint).toBe("https://staging.example.com");
      expect(config.apiKey).toBeUndefined();
    });

    it("explicit profileName argument overrides PHOENIX_PROFILE env var", () => {
      writeTempSettings(tmpDir, {
        activeProfile: null,
        profiles: {
          "from-env": { endpoint: "https://from-env.example.com" },
          "from-arg": { endpoint: "https://from-arg.example.com" },
        },
      });
      process.env.PHOENIX_PROFILE = "from-env";
      const config = loadConfigFromProfile("from-arg");
      expect(config.endpoint).toBe("https://from-arg.example.com");
    });

    it("throws ProfileResolutionError when explicit --profile name does not exist", () => {
      writeTempSettings(tmpDir, {
        activeProfile: null,
        profiles: { dev: { endpoint: "http://dev.example.com" } },
      });
      expect(() => loadConfigFromProfile("nonexistent")).toThrow(
        ProfileResolutionError
      );
    });

    it("throws ProfileResolutionError when PHOENIX_PROFILE names a missing profile", () => {
      writeTempSettings(tmpDir, {
        activeProfile: null,
        profiles: { dev: { endpoint: "http://dev.example.com" } },
      });
      process.env.PHOENIX_PROFILE = "nonexistent";
      expect(() => loadConfigFromProfile()).toThrow(ProfileResolutionError);
    });

    it("returns empty config when stored activeProfile points to a missing entry (no explicit request)", () => {
      // This can happen if someone hand-edits profiles.json. No explicit
      // request means fall through silently to env/defaults.
      writeTempSettings(tmpDir, {
        activeProfile: "ghost",
        profiles: { dev: { endpoint: "http://dev.example.com" } },
      });
      const config = loadConfigFromProfile();
      expect(config).toEqual({});
    });

    it("loads only the fields present in the profile entry", () => {
      writeTempSettings(tmpDir, {
        activeProfile: "partial",
        profiles: { partial: { project: "only-project" } },
      });
      const config = loadConfigFromProfile();
      expect(config.project).toBe("only-project");
      expect(config.apiKey).toBeUndefined();
      expect(config.endpoint).toBeUndefined();
    });

    it("loads headers from profile", () => {
      writeTempSettings(tmpDir, {
        activeProfile: "with-headers",
        profiles: {
          "with-headers": { headers: { Authorization: "Bearer token" } },
        },
      });
      const config = loadConfigFromProfile();
      expect(config.headers).toEqual({ Authorization: "Bearer token" });
    });
  });

  // -------------------------------------------------------------------------
  // resolveConfig — 4-tier merge
  // -------------------------------------------------------------------------

  describe("resolveConfig", () => {
    // --- Tier 4: built-in defaults ---

    it("applies built-in default endpoint when nothing else is set", () => {
      const config = resolveConfig({ cliOptions: {} });
      expect(config.endpoint).toBe("http://localhost:6006");
    });

    // --- Tier 3: profile overrides built-in defaults ---

    it("profile endpoint overrides built-in default", () => {
      writeTempSettings(tmpDir, {
        activeProfile: "prod",
        profiles: { prod: { endpoint: "https://prod.example.com" } },
      });
      const config = resolveConfig({ cliOptions: {} });
      expect(config.endpoint).toBe("https://prod.example.com");
    });

    it("profile contributes apiKey when set", () => {
      writeTempSettings(tmpDir, {
        activeProfile: "prod",
        profiles: {
          prod: { endpoint: "https://prod.example.com", apiKey: "profile-key" },
        },
      });
      const config = resolveConfig({ cliOptions: {} });
      expect(config.apiKey).toBe("profile-key");
    });

    it("profile without apiKey does not set apiKey in resolved config", () => {
      writeTempSettings(tmpDir, {
        activeProfile: "prod",
        profiles: {
          prod: { endpoint: "https://prod.example.com" },
        },
      });
      const config = resolveConfig({ cliOptions: {} });
      expect(config.apiKey).toBeUndefined();
    });

    it("resolves profile via profileName argument", () => {
      writeTempSettings(tmpDir, {
        activeProfile: null,
        profiles: {
          staging: { endpoint: "https://staging.example.com" },
        },
      });
      const config = resolveConfig({ cliOptions: {}, profileName: "staging" });
      expect(config.endpoint).toBe("https://staging.example.com");
    });

    it("resolves profile via PHOENIX_PROFILE env var", () => {
      writeTempSettings(tmpDir, {
        activeProfile: null,
        profiles: {
          staging: { endpoint: "https://staging.example.com" },
        },
      });
      process.env.PHOENIX_PROFILE = "staging";
      const config = resolveConfig({ cliOptions: {} });
      expect(config.endpoint).toBe("https://staging.example.com");
      expect(config.apiKey).toBeUndefined();
    });

    // --- Tier 2: env var overrides profile ---

    it("env var endpoint overrides profile endpoint", () => {
      writeTempSettings(tmpDir, {
        activeProfile: "prod",
        profiles: {
          prod: {
            endpoint: "https://prod.example.com",
            project: "prod-project",
          },
        },
      });
      process.env.PHOENIX_HOST = "http://env-host:6006";

      const config = resolveConfig({ cliOptions: {} });
      expect(config.endpoint).toBe("http://env-host:6006");
      // Profile-only field still comes through
      expect(config.project).toBe("prod-project");
    });

    it("env var apiKey overrides profile apiKey", () => {
      writeTempSettings(tmpDir, {
        activeProfile: "dev",
        profiles: {
          dev: { endpoint: "http://dev.example.com", apiKey: "profile-key" },
        },
      });
      process.env.PHOENIX_API_KEY = "env-key";

      const config = resolveConfig({ cliOptions: {} });
      expect(config.apiKey).toBe("env-key");
    });

    it("env var does not clobber profile fields it does not set", () => {
      writeTempSettings(tmpDir, {
        activeProfile: "dev",
        profiles: { dev: { project: "profile-project" } },
      });
      process.env.PHOENIX_HOST = "http://env-host:6006";
      // PHOENIX_PROJECT not set

      const config = resolveConfig({ cliOptions: {} });
      expect(config.project).toBe("profile-project");
      expect(config.endpoint).toBe("http://env-host:6006");
    });

    // --- Tier 1: CLI flags override everything ---

    it("CLI endpoint overrides env var", () => {
      process.env.PHOENIX_HOST = "http://env-host:6006";

      const config = resolveConfig({
        cliOptions: { endpoint: "http://cli-host:6006" },
      });

      expect(config.endpoint).toBe("http://cli-host:6006");
    });

    it("CLI endpoint overrides profile endpoint", () => {
      writeTempSettings(tmpDir, {
        activeProfile: "prod",
        profiles: { prod: { endpoint: "https://prod.example.com" } },
      });

      const config = resolveConfig({
        cliOptions: { endpoint: "http://cli-host:6006" },
      });

      expect(config.endpoint).toBe("http://cli-host:6006");
    });

    it("CLI flags override all lower tiers simultaneously", () => {
      writeTempSettings(tmpDir, {
        activeProfile: "prod",
        profiles: {
          prod: {
            endpoint: "https://prod.example.com",
            project: "profile-project",
          },
        },
      });
      process.env.PHOENIX_HOST = "http://env-host:6006";
      process.env.PHOENIX_API_KEY = "env-key";

      const config = resolveConfig({
        cliOptions: {
          endpoint: "http://cli-host:6006",
          apiKey: "cli-key",
          project: "cli-project",
        },
      });

      expect(config.endpoint).toBe("http://cli-host:6006");
      expect(config.apiKey).toBe("cli-key");
      expect(config.project).toBe("cli-project");
    });

    // --- undefined CLI options do not clobber lower tiers ---

    it("undefined CLI option does not clobber env var", () => {
      process.env.PHOENIX_HOST = "http://localhost:6006";

      const config = resolveConfig({
        cliOptions: { endpoint: undefined },
      });

      expect(config.endpoint).toBe("http://localhost:6006");
    });

    it("undefined CLI option does not clobber profile value", () => {
      writeTempSettings(tmpDir, {
        activeProfile: "dev",
        profiles: { dev: { project: "profile-project" } },
      });

      const config = resolveConfig({
        cliOptions: { project: undefined },
      });

      expect(config.project).toBe("profile-project");
    });

    // --- merge correctness ---

    it("merges env and CLI options, each contributing distinct fields", () => {
      process.env.PHOENIX_HOST = "http://localhost:6006";

      const config = resolveConfig({
        cliOptions: { project: "cli-project" },
      });

      expect(config.endpoint).toBe("http://localhost:6006");
      expect(config.project).toBe("cli-project");
    });

    // --- strict named-profile resolution ---

    it("throws ProfileResolutionError when profileName does not resolve", () => {
      writeTempSettings(tmpDir, {
        activeProfile: null,
        profiles: { dev: { endpoint: "http://dev.example.com" } },
      });
      expect(() =>
        resolveConfig({ cliOptions: {}, profileName: "nonexistent" })
      ).toThrow(ProfileResolutionError);
    });

    it("throws ProfileResolutionError when PHOENIX_PROFILE does not resolve", () => {
      writeTempSettings(tmpDir, {
        activeProfile: null,
        profiles: { dev: { endpoint: "http://dev.example.com" } },
      });
      process.env.PHOENIX_PROFILE = "nonexistent";
      expect(() => resolveConfig({ cliOptions: {} })).toThrow(
        ProfileResolutionError
      );
    });

    // --- backward compatibility ---

    it("backward compat: resolves without profileName (no profiles file)", () => {
      // Pre-profiles behaviour: env var + CLI only, with default endpoint fallback
      process.env.PHOENIX_HOST = "http://localhost:6006";
      process.env.PHOENIX_PROJECT = "my-project";

      const config = resolveConfig({ cliOptions: {} });

      expect(config.endpoint).toBe("http://localhost:6006");
      expect(config.project).toBe("my-project");
    });

    it("backward compat: default endpoint is applied when only project is set", () => {
      process.env.PHOENIX_PROJECT = "only-project";

      const config = resolveConfig({ cliOptions: {} });

      expect(config.endpoint).toBe("http://localhost:6006");
      expect(config.project).toBe("only-project");
    });
  });

  // -------------------------------------------------------------------------
  // validateConfig
  // -------------------------------------------------------------------------

  describe("validateConfig", () => {
    it("should validate complete config", () => {
      const config: PhoenixConfig = {
        endpoint: "http://localhost:6006",
        project: "test-project",
      };

      const validation = validateConfig({ config });

      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it("should require endpoint", () => {
      const config: PhoenixConfig = {
        project: "test-project",
      };

      const validation = validateConfig({ config });

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain(
        "Phoenix endpoint not configured. Set PHOENIX_HOST environment variable or use --endpoint flag."
      );
    });

    it("should require project", () => {
      const config: PhoenixConfig = {
        endpoint: "http://localhost:6006",
      };

      const validation = validateConfig({ config });

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain(
        "Project not configured. Set PHOENIX_PROJECT environment variable or use --project flag."
      );
    });
  });

  // -------------------------------------------------------------------------
  // getConfigErrorMessage
  // -------------------------------------------------------------------------

  describe("getConfigErrorMessage", () => {
    it("should format error messages with helpful instructions", () => {
      const errors = [
        "Phoenix endpoint not configured.",
        "Project not configured.",
      ];

      const message = getConfigErrorMessage({ errors });

      expect(message).toContain("Configuration Error:");
      expect(message).toContain("Phoenix endpoint not configured.");
      expect(message).toContain("Project not configured.");
      expect(message).toContain("Quick Start:");
      expect(message).toContain("export PHOENIX_HOST=");
      expect(message).toContain("export PHOENIX_PROJECT=");
    });
  });
});
