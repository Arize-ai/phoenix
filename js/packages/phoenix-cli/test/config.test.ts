import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import {
  clearEnvFileCache,
  resetCrossTierEndpointWarningsForTesting,
} from "@arizeai/phoenix-config";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

    it("should load project from PHOENIX_PROJECT_NAME alias", () => {
      process.env.PHOENIX_PROJECT_NAME = "alias-project";
      const config = loadConfigFromEnvironment();
      expect(config.project).toBe("alias-project");
    });

    it("should prefer PHOENIX_PROJECT over PHOENIX_PROJECT_NAME", () => {
      process.env.PHOENIX_PROJECT = "canonical-project";
      process.env.PHOENIX_PROJECT_NAME = "alias-project";
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

    it("uses profile OAuth tokens only when no API key source is configured", () => {
      const settings: SettingsFile = {
        activeProfile: "prod",
        profiles: {
          prod: {
            endpoint: "https://prod.example.com",
            oauthTokens: {
              accessToken: "oauth-access",
              refreshToken: "oauth-refresh",
              expiresAt: "2026-01-01T00:00:00.000Z",
              scope: "",
            },
          },
        },
      };
      const settingsPath = path.join(tmpDir, "px", "settings.json");
      fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
      saveSettings(settings, { settingsPath });

      const oauthConfig = resolveConfig({ cliOptions: {} });
      expect(oauthConfig.credentialSource).toBe("oauth");
      expect(oauthConfig.oauthTokens?.accessToken).toBe("oauth-access");

      process.env.PHOENIX_API_KEY = "env-key";
      const envConfig = resolveConfig({ cliOptions: {} });
      expect(envConfig.credentialSource).toBe("env");
      expect(envConfig.oauthTokens).toBeUndefined();

      const cliConfig = resolveConfig({
        cliOptions: { apiKey: "cli-key" },
      });
      expect(cliConfig.credentialSource).toBe("flag");
      expect(cliConfig.oauthTokens).toBeUndefined();
    });

    it("drops profile OAuth tokens when the endpoint is overridden", () => {
      const settings: SettingsFile = {
        activeProfile: "prod",
        profiles: {
          prod: {
            endpoint: "https://prod.example.com",
            oauthTokens: {
              accessToken: "oauth-access",
              refreshToken: "oauth-refresh",
              expiresAt: "2026-01-01T00:00:00.000Z",
              scope: "",
            },
          },
        },
      };
      const settingsPath = path.join(tmpDir, "px", "settings.json");
      fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
      saveSettings(settings, { settingsPath });

      const flagConfig = resolveConfig({
        cliOptions: { endpoint: "https://staging.example.com" },
      });
      expect(flagConfig.credentialSource).toBe("none");
      expect(flagConfig.oauthTokens).toBeUndefined();

      process.env.PHOENIX_HOST = "https://staging.example.com";
      const envConfig = resolveConfig({ cliOptions: {} });
      expect(envConfig.credentialSource).toBe("none");
      expect(envConfig.oauthTokens).toBeUndefined();
      delete process.env.PHOENIX_HOST;

      // An override matching the issuing endpoint keeps the tokens.
      const matchingConfig = resolveConfig({
        cliOptions: { endpoint: "https://prod.example.com" },
      });
      expect(matchingConfig.credentialSource).toBe("oauth");
      expect(matchingConfig.oauthTokens?.accessToken).toBe("oauth-access");
    });

    it("prefers a profile API key over profile OAuth tokens", () => {
      const settings: SettingsFile = {
        activeProfile: "prod",
        profiles: {
          prod: {
            endpoint: "https://prod.example.com",
            apiKey: "profile-key",
            oauthTokens: {
              accessToken: "oauth-access",
              refreshToken: "oauth-refresh",
              expiresAt: "2026-01-01T00:00:00.000Z",
              scope: "",
            },
          },
        },
      };
      const settingsPath = path.join(tmpDir, "px", "settings.json");
      fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
      saveSettings(settings, { settingsPath });

      const config = resolveConfig({ cliOptions: {} });
      expect(config.credentialSource).toBe("profile-key");
      expect(config.apiKey).toBe("profile-key");
      expect(config.oauthTokens).toBeUndefined();
    });
  });

  describe(".env.phoenix precedence", () => {
    let envFileDir: string;

    beforeEach(() => {
      envFileDir = fs.mkdtempSync(path.join(os.tmpdir(), "phoenix-env-file-"));
      // Discovery is disabled globally in test/setup.ts; re-enable it here.
      delete process.env.PHOENIX_DISCOVER_CONFIG;
      vi.spyOn(process, "cwd").mockReturnValue(envFileDir);
      clearEnvFileCache();
      resetCrossTierEndpointWarningsForTesting();
    });

    afterEach(() => {
      vi.restoreAllMocks();
      clearEnvFileCache();
      fs.rmSync(envFileDir, { recursive: true, force: true });
    });

    function writeEnvFile(contents: string): void {
      fs.writeFileSync(path.join(envFileDir, ".env.phoenix"), contents);
    }

    function saveProfile(): void {
      const settings: SettingsFile = {
        activeProfile: "staging",
        profiles: {
          staging: {
            endpoint: "https://staging.example.com",
            apiKey: "profile-key",
          },
        },
      };
      const settingsPath = path.join(tmpDir, "px", "settings.json");
      fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
      saveSettings(settings, { settingsPath });
    }

    it("applies file values when nothing else provides them", () => {
      writeEnvFile(
        "PHOENIX_API_KEY=file-key\nPHOENIX_HOST=http://file-host:6006\n"
      );
      const config = resolveConfig({ cliOptions: {} });
      expect(config.apiKey).toBe("file-key");
      expect(config.endpoint).toBe("http://file-host:6006");
    });

    it("never lets file values override an explicitly selected profile", () => {
      writeEnvFile("PHOENIX_API_KEY=file-key\n");
      saveProfile();
      const config = resolveConfig({ cliOptions: {}, profileName: "staging" });
      expect(config.apiKey).toBe("profile-key");
      expect(config.endpoint).toBe("https://staging.example.com");
    });

    it("ranks file values below the active profile but process env above it", () => {
      writeEnvFile("PHOENIX_API_KEY=file-key\nPHOENIX_PROJECT=file-project\n");
      saveProfile();
      process.env.PHOENIX_HOST = "http://process-host:6006";
      const config = resolveConfig({ cliOptions: {} });
      expect(config.apiKey).toBe("profile-key");
      expect(config.endpoint).toBe("http://process-host:6006");
      expect(config.project).toBe("file-project");
    });

    it("does not mix process credentials with file credentials", () => {
      writeEnvFile("PHOENIX_API_KEY=file-key\n");
      process.env.PHOENIX_CLIENT_HEADERS = '{"X-Custom": "value"}';
      const config = resolveConfig({ cliOptions: {} });
      expect(config.apiKey).toBeUndefined();
      expect(config.headers).toEqual({ "X-Custom": "value" });
    });

    it("warns once while retaining a file endpoint and process credentials", () => {
      const filePath = path.join(envFileDir, ".env.phoenix");
      writeEnvFile("PHOENIX_HOST=http://file-host:6006\n");
      fs.chmodSync(filePath, 0o600);
      process.env.PHOENIX_API_KEY = "secret-process-key";
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const config = resolveConfig({ cliOptions: {} });
      resolveConfig({ cliOptions: {} });

      expect(config).toMatchObject({
        apiKey: "secret-process-key",
        endpoint: "http://file-host:6006",
      });
      expect(warnSpy).toHaveBeenCalledOnce();
      expect(warnSpy).toHaveBeenCalledWith(
        `Credentials from the process environment will be sent to PHOENIX_HOST set by ${filePath}.`
      );
      expect(warnSpy.mock.calls[0]?.[0]).not.toContain("secret-process-key");
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
        "Project not configured. Set PHOENIX_PROJECT environment variable or use --project flag."
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
      expect(message).toContain("export PHOENIX_PROJECT=");
    });
  });
});
