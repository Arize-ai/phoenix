import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  getConfigErrorMessage,
  loadConfigFromEnvironment,
  type PhoenixConfig,
  resolveConfig,
  validateConfig,
} from "../src/config";
import { type SettingsFile, saveSettings } from "../src/settings";

describe("Configuration", () => {
  let originalEnv: NodeJS.ProcessEnv;
  let tmpDir: string;

  beforeEach(() => {
    originalEnv = { ...process.env };

    delete process.env.PHOENIX_HOST;
    delete process.env.PHOENIX_PROJECT;
    delete process.env.PHOENIX_PROJECT_NAME;
    delete process.env.PHOENIX_API_KEY;
    delete process.env.PHOENIX_CLIENT_HEADERS;

    // Redirect XDG_CONFIG_HOME so profile resolution stays isolated from
    // the developer's real ~/.px/settings.json.
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "phoenix-config-test-"));
    process.env.XDG_CONFIG_HOME = tmpDir;
  });

  afterEach(() => {
    process.env = originalEnv;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

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

    it("should handle missing environment variables", () => {
      // After the profile-aware refactor, loadConfigFromEnvironment() no
      // longer injects the default endpoint — that's getBuiltInDefaults()'s
      // job. resolveConfig still applies it (covered below).
      const config = loadConfigFromEnvironment();
      expect(config.endpoint).toBeUndefined();
      expect(config.project).toBeUndefined();
      expect(config.apiKey).toBeUndefined();
    });

    it("should load project from PHOENIX_PROJECT_NAME", () => {
      process.env.PHOENIX_PROJECT_NAME = "canonical-project";
      const config = loadConfigFromEnvironment();
      expect(config.project).toBe("canonical-project");
    });

    it("should prefer PHOENIX_PROJECT_NAME over PHOENIX_PROJECT", () => {
      process.env.PHOENIX_PROJECT_NAME = "canonical-project";
      process.env.PHOENIX_PROJECT = "alias-project";
      const config = loadConfigFromEnvironment();
      expect(config.project).toBe("canonical-project");
    });

    it("should load custom headers from environment", () => {
      process.env.PHOENIX_CLIENT_HEADERS = '{"X-Custom": "value"}';
      const config = loadConfigFromEnvironment();
      expect(config.headers).toEqual({ "X-Custom": "value" });
    });
  });

  describe("resolveConfig", () => {
    it("should prioritize CLI options over environment", () => {
      process.env.PHOENIX_HOST = "http://env-host:6006";

      const config = resolveConfig({
        cliOptions: { endpoint: "http://cli-host:6006" },
      });

      expect(config.endpoint).toBe("http://cli-host:6006");
    });

    it("should merge configs from environment and CLI options", () => {
      process.env.PHOENIX_HOST = "http://localhost:6006";

      const config = resolveConfig({ cliOptions: { project: "cli-project" } });

      expect(config.endpoint).toBe("http://localhost:6006");
      expect(config.project).toBe("cli-project");
    });

    it("should not clobber environment values with undefined CLI options", () => {
      process.env.PHOENIX_HOST = "http://localhost:6006";

      const config = resolveConfig({ cliOptions: { endpoint: undefined } });

      expect(config.endpoint).toBe("http://localhost:6006");
    });

    it("flows profile values through but yields to env vars and CLI flags", () => {
      // Active profile contributes endpoint + project + apiKey.
      const settings: SettingsFile = {
        activeProfile: "prod",
        profiles: {
          prod: {
            endpoint: "https://prod.example.com",
            project: "profile-project",
            apiKey: "profile-key",
          },
        },
      };
      const settingsPath = path.join(tmpDir, "px", "settings.json");
      fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
      saveSettings(settings, { settingsPath });

      // Env var overrides apiKey, CLI flag overrides endpoint, project flows
      // from the profile (not set in env or CLI).
      process.env.PHOENIX_API_KEY = "env-key";

      const config = resolveConfig({
        cliOptions: { endpoint: "http://cli-host:6006" },
      });

      expect(config.endpoint).toBe("http://cli-host:6006");
      expect(config.apiKey).toBe("env-key");
      expect(config.project).toBe("profile-project");
    });
  });

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
      const config: PhoenixConfig = { project: "test-project" };
      const validation = validateConfig({ config });
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain(
        "Phoenix endpoint not configured. Set PHOENIX_HOST environment variable or use --endpoint flag."
      );
    });

    it("should require project", () => {
      const config: PhoenixConfig = { endpoint: "http://localhost:6006" };
      const validation = validateConfig({ config });
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain(
        "Project not configured. Set PHOENIX_PROJECT_NAME environment variable or use --project flag."
      );
    });
  });

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
      expect(message).toContain("export PHOENIX_PROJECT_NAME=");
    });
  });
});
