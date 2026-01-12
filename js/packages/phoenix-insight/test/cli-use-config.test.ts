import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  initializeConfig,
  resetConfig,
  type CliArgs,
  type Config,
} from "../src/config/index.js";

// Mock node:fs/promises
vi.mock("node:fs/promises", () => ({
  readFile: vi.fn(),
  access: vi.fn(),
  mkdir: vi.fn(),
  writeFile: vi.fn(),
}));

import * as fs from "node:fs/promises";

const mockReadFile = vi.mocked(fs.readFile);
const mockAccess = vi.mocked(fs.access);
const mockMkdir = vi.mocked(fs.mkdir);
const mockWriteFile = vi.mocked(fs.writeFile);

describe("cli-use-config", () => {
  // Save original env vars
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Reset config singleton before each test
    resetConfig();
    // Clear all mock calls
    vi.clearAllMocks();
    // Reset environment variables
    process.env = { ...originalEnv };
    // Clear any PHOENIX-related env vars to ensure clean state
    delete process.env.PHOENIX_BASE_URL;
    delete process.env.PHOENIX_API_KEY;
    delete process.env.PHOENIX_INSIGHT_LIMIT;
    delete process.env.PHOENIX_INSIGHT_STREAM;
    delete process.env.PHOENIX_INSIGHT_MODE;
    delete process.env.PHOENIX_INSIGHT_REFRESH;
    delete process.env.PHOENIX_INSIGHT_TRACE;
    delete process.env.PHOENIX_INSIGHT_CONFIG;
  });

  afterEach(() => {
    // Restore original env vars
    process.env = originalEnv;
    resetConfig();
  });

  /**
   * Helper to set up mock fs to return config file content
   */
  function mockConfigFile(content: Record<string, unknown> | null): void {
    if (content === null) {
      // Simulate file not found
      mockReadFile.mockRejectedValue(
        Object.assign(new Error("ENOENT"), { code: "ENOENT" })
      );
    } else {
      mockReadFile.mockResolvedValue(JSON.stringify(content));
    }
    // Default config file doesn't exist, so createDefaultConfig will try to create it
    mockAccess.mockRejectedValue(
      Object.assign(new Error("ENOENT"), { code: "ENOENT" })
    );
    mockMkdir.mockResolvedValue(undefined);
    mockWriteFile.mockResolvedValue(undefined);
  }

  describe("config values override CLI defaults", () => {
    it("should use baseUrl from config file when no CLI arg provided", async () => {
      mockConfigFile({ baseUrl: "http://custom-phoenix:8080" });

      const config = await initializeConfig({});

      expect(config.baseUrl).toBe("http://custom-phoenix:8080");
    });

    it("should use apiKey from config file", async () => {
      mockConfigFile({ apiKey: "test-api-key-from-config" });

      const config = await initializeConfig({});

      expect(config.apiKey).toBe("test-api-key-from-config");
    });

    it("should use limit from config file", async () => {
      mockConfigFile({ limit: 500 });

      const config = await initializeConfig({});

      expect(config.limit).toBe(500);
    });

    it("should use stream setting from config file", async () => {
      mockConfigFile({ stream: false });

      const config = await initializeConfig({});

      expect(config.stream).toBe(false);
    });

    it("should use mode setting from config file", async () => {
      mockConfigFile({ mode: "local" });

      const config = await initializeConfig({});

      expect(config.mode).toBe("local");
    });

    it("should use refresh setting from config file", async () => {
      mockConfigFile({ refresh: true });

      const config = await initializeConfig({});

      expect(config.refresh).toBe(true);
    });

    it("should use trace setting from config file", async () => {
      mockConfigFile({ trace: true });

      const config = await initializeConfig({});

      expect(config.trace).toBe(true);
    });
  });

  describe("CLI args override config file", () => {
    it("should prefer baseUrl CLI arg over config file", async () => {
      mockConfigFile({ baseUrl: "http://from-config:6006" });

      const config = await initializeConfig({
        baseUrl: "http://from-cli:6006",
      });

      expect(config.baseUrl).toBe("http://from-cli:6006");
    });

    it("should prefer apiKey CLI arg over config file", async () => {
      mockConfigFile({ apiKey: "key-from-config" });

      const config = await initializeConfig({ apiKey: "key-from-cli" });

      expect(config.apiKey).toBe("key-from-cli");
    });

    it("should prefer limit CLI arg over config file", async () => {
      mockConfigFile({ limit: 100 });

      const config = await initializeConfig({ limit: 2000 });

      expect(config.limit).toBe(2000);
    });

    it("should prefer stream CLI arg over config file", async () => {
      mockConfigFile({ stream: true });

      const config = await initializeConfig({ stream: false });

      expect(config.stream).toBe(false);
    });

    it("should prefer --local CLI flag over config mode", async () => {
      mockConfigFile({ mode: "sandbox" });

      const config = await initializeConfig({ local: true });

      expect(config.mode).toBe("local");
    });

    it("should prefer --refresh CLI flag over config refresh", async () => {
      mockConfigFile({ refresh: false });

      const config = await initializeConfig({ refresh: true });

      expect(config.refresh).toBe(true);
    });

    it("should prefer --trace CLI flag over config trace", async () => {
      mockConfigFile({ trace: false });

      const config = await initializeConfig({ trace: true });

      expect(config.trace).toBe(true);
    });
  });

  describe("environment variables override config file", () => {
    it("should prefer PHOENIX_BASE_URL env var over config file", async () => {
      mockConfigFile({ baseUrl: "http://from-config:6006" });
      process.env.PHOENIX_BASE_URL = "http://from-env:6006";

      const config = await initializeConfig({});

      expect(config.baseUrl).toBe("http://from-env:6006");
    });

    it("should prefer PHOENIX_API_KEY env var over config file", async () => {
      mockConfigFile({ apiKey: "key-from-config" });
      process.env.PHOENIX_API_KEY = "key-from-env";

      const config = await initializeConfig({});

      expect(config.apiKey).toBe("key-from-env");
    });

    it("should prefer PHOENIX_INSIGHT_LIMIT env var over config file", async () => {
      mockConfigFile({ limit: 100 });
      process.env.PHOENIX_INSIGHT_LIMIT = "5000";

      const config = await initializeConfig({});

      expect(config.limit).toBe(5000);
    });

    it("should prefer PHOENIX_INSIGHT_MODE env var over config file", async () => {
      mockConfigFile({ mode: "sandbox" });
      process.env.PHOENIX_INSIGHT_MODE = "local";

      const config = await initializeConfig({});

      expect(config.mode).toBe("local");
    });
  });

  describe("CLI args override environment variables", () => {
    it("should prefer CLI baseUrl over env var", async () => {
      mockConfigFile({});
      process.env.PHOENIX_BASE_URL = "http://from-env:6006";

      const config = await initializeConfig({
        baseUrl: "http://from-cli:6006",
      });

      expect(config.baseUrl).toBe("http://from-cli:6006");
    });

    it("should prefer CLI apiKey over env var", async () => {
      mockConfigFile({});
      process.env.PHOENIX_API_KEY = "key-from-env";

      const config = await initializeConfig({ apiKey: "key-from-cli" });

      expect(config.apiKey).toBe("key-from-cli");
    });

    it("should prefer CLI limit over env var", async () => {
      mockConfigFile({});
      process.env.PHOENIX_INSIGHT_LIMIT = "5000";

      const config = await initializeConfig({ limit: 100 });

      expect(config.limit).toBe(100);
    });
  });

  describe("full priority chain: config file < env var < CLI", () => {
    it("should apply correct priority when all three sources set baseUrl", async () => {
      mockConfigFile({ baseUrl: "http://from-config:6006" });
      process.env.PHOENIX_BASE_URL = "http://from-env:6006";

      // Without CLI arg, env should win
      const configNoCliArg = await initializeConfig({});
      expect(configNoCliArg.baseUrl).toBe("http://from-env:6006");

      // Reset and test with CLI arg
      resetConfig();

      const configWithCliArg = await initializeConfig({
        baseUrl: "http://from-cli:6006",
      });
      expect(configWithCliArg.baseUrl).toBe("http://from-cli:6006");
    });
  });

  describe("default values from config schema", () => {
    it("should work without any config file (uses defaults)", async () => {
      mockConfigFile(null); // File not found

      const config = await initializeConfig({});

      // Check default values from schema
      expect(config.baseUrl).toBe("http://localhost:6006");
      expect(config.apiKey).toBeUndefined();
      expect(config.limit).toBe(1000);
      expect(config.stream).toBe(true);
      expect(config.mode).toBe("sandbox");
      expect(config.refresh).toBe(false);
      expect(config.trace).toBe(false);
    });

    it("should work with empty config file (uses defaults)", async () => {
      mockConfigFile({});

      const config = await initializeConfig({});

      expect(config.baseUrl).toBe("http://localhost:6006");
      expect(config.limit).toBe(1000);
      expect(config.mode).toBe("sandbox");
    });

    it("should apply partial config with defaults for missing fields", async () => {
      mockConfigFile({ baseUrl: "http://custom:8080" });

      const config = await initializeConfig({});

      expect(config.baseUrl).toBe("http://custom:8080");
      // Other fields should be defaults
      expect(config.limit).toBe(1000);
      expect(config.stream).toBe(true);
      expect(config.mode).toBe("sandbox");
    });
  });

  describe("custom config file path", () => {
    it("should load config from custom path via CLI arg", async () => {
      mockConfigFile({ baseUrl: "http://custom-config:9999" });

      const config = await initializeConfig({
        config: "/custom/path/config.json",
      });

      expect(config.baseUrl).toBe("http://custom-config:9999");
      // Verify readFile was called (file loading attempted)
      expect(mockReadFile).toHaveBeenCalled();
    });
  });

  describe("invalid config handling", () => {
    it("should fall back to defaults on invalid JSON", async () => {
      // Simulate JSON parse error
      mockReadFile.mockRejectedValue(new SyntaxError("Unexpected token"));
      mockAccess.mockRejectedValue(
        Object.assign(new Error("ENOENT"), { code: "ENOENT" })
      );
      mockMkdir.mockResolvedValue(undefined);
      mockWriteFile.mockResolvedValue(undefined);

      const config = await initializeConfig({});

      // Should use defaults
      expect(config.baseUrl).toBe("http://localhost:6006");
      expect(config.limit).toBe(1000);
    });

    it("should ignore invalid config values and use defaults", async () => {
      // Invalid limit (negative number)
      mockConfigFile({ limit: -100 });

      const config = await initializeConfig({});

      // Zod validation should reject negative limit, fall back to defaults
      expect(config.limit).toBe(1000);
    });

    it("should ignore invalid mode values and use defaults", async () => {
      mockConfigFile({ mode: "invalid-mode" });

      const config = await initializeConfig({});

      // Should fall back to default mode
      expect(config.mode).toBe("sandbox");
    });
  });
});
