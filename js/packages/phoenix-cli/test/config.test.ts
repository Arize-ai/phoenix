import {
  getConfigErrorMessage,
  loadConfigFromEnvironment,
  type PhoenixConfig,
  resolveConfig,
  validateConfig,
} from "../src/config";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

describe("Configuration", () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };

    // Clear environment variables
    delete process.env.PHOENIX_HOST;
    delete process.env.PHOENIX_PROJECT;
    delete process.env.PHOENIX_API_KEY;
    delete process.env.PHOENIX_CLIENT_HEADERS;
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
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
      const config = loadConfigFromEnvironment();

      expect(config.endpoint).toBeUndefined();
      expect(config.project).toBeUndefined();
      expect(config.apiKey).toBeUndefined();
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
        cliOptions: {
          endpoint: "http://cli-host:6006",
        },
      });

      expect(config.endpoint).toBe("http://cli-host:6006");
    });

    it("should merge configs from environment and CLI options", () => {
      process.env.PHOENIX_HOST = "http://localhost:6006";

      const config = resolveConfig({
        cliOptions: {
          project: "cli-project",
        },
      });

      expect(config.endpoint).toBe("http://localhost:6006");
      expect(config.project).toBe("cli-project");
    });

    it("should not clobber environment values with undefined CLI options", () => {
      process.env.PHOENIX_HOST = "http://localhost:6006";

      const config = resolveConfig({
        cliOptions: {
          endpoint: undefined,
        },
      });

      expect(config.endpoint).toBe("http://localhost:6006");
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
