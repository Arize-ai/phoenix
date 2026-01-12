import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import {
  initializeConfig,
  getConfig,
  resetConfig,
  type CliArgs,
} from "../../src/config/index";
import { getDefaultConfig } from "../../src/config/schema";

// Mock fs module
vi.mock("node:fs/promises");

describe("config singleton", () => {
  let originalEnv: NodeJS.ProcessEnv;
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Save original env
    originalEnv = { ...process.env };
    // Clear all relevant env vars
    delete process.env.PHOENIX_INSIGHT_CONFIG;
    delete process.env.PHOENIX_BASE_URL;
    delete process.env.PHOENIX_API_KEY;
    delete process.env.PHOENIX_INSIGHT_LIMIT;
    delete process.env.PHOENIX_INSIGHT_STREAM;
    delete process.env.PHOENIX_INSIGHT_MODE;
    delete process.env.PHOENIX_INSIGHT_REFRESH;
    delete process.env.PHOENIX_INSIGHT_TRACE;
    // Reset config singleton
    resetConfig();
    // Reset mocks
    vi.clearAllMocks();
    // Spy on console methods
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    // Restore original env
    process.env = originalEnv;
    // Restore spies
    warnSpy.mockRestore();
    errorSpy.mockRestore();
    // Reset config singleton
    resetConfig();
  });

  describe("initializeConfig", () => {
    it("should return default config when no config file exists", async () => {
      // Mock: file doesn't exist
      const enoentError = new Error("File not found") as NodeJS.ErrnoException;
      enoentError.code = "ENOENT";
      vi.mocked(fs.readFile).mockRejectedValue(enoentError);
      vi.mocked(fs.access).mockRejectedValue(enoentError);
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      const config = await initializeConfig();

      expect(config).toEqual(getDefaultConfig());
    });

    it("should load config from file", async () => {
      const fileConfig = {
        baseUrl: "https://custom.phoenix.com",
        limit: 500,
      };
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(fileConfig));

      const config = await initializeConfig();

      expect(config.baseUrl).toBe("https://custom.phoenix.com");
      expect(config.limit).toBe(500);
      // Defaults should still be applied for missing fields
      expect(config.stream).toBe(true);
      expect(config.mode).toBe("sandbox");
    });

    it("should override file config with env vars", async () => {
      const fileConfig = {
        baseUrl: "https://file.phoenix.com",
        limit: 500,
      };
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(fileConfig));

      // Set env vars
      process.env.PHOENIX_BASE_URL = "https://env.phoenix.com";
      process.env.PHOENIX_INSIGHT_LIMIT = "1500";

      const config = await initializeConfig();

      // Env vars should override file config
      expect(config.baseUrl).toBe("https://env.phoenix.com");
      expect(config.limit).toBe(1500);
    });

    it("should override env vars with CLI args", async () => {
      const fileConfig = {
        baseUrl: "https://file.phoenix.com",
        limit: 500,
      };
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(fileConfig));

      // Set env vars
      process.env.PHOENIX_BASE_URL = "https://env.phoenix.com";
      process.env.PHOENIX_INSIGHT_LIMIT = "1500";

      // Set CLI args
      const cliArgs: CliArgs = {
        baseUrl: "https://cli.phoenix.com",
        limit: 2000,
      };

      const config = await initializeConfig(cliArgs);

      // CLI args should override everything
      expect(config.baseUrl).toBe("https://cli.phoenix.com");
      expect(config.limit).toBe(2000);
    });

    it("should handle all CLI args", async () => {
      const enoentError = new Error("File not found") as NodeJS.ErrnoException;
      enoentError.code = "ENOENT";
      vi.mocked(fs.readFile).mockRejectedValue(enoentError);
      vi.mocked(fs.access).mockRejectedValue(enoentError);
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      const cliArgs: CliArgs = {
        baseUrl: "https://cli.phoenix.com",
        apiKey: "cli-key",
        limit: 2000,
        stream: false,
        local: true,
        refresh: true,
        trace: true,
      };

      const config = await initializeConfig(cliArgs);

      expect(config.baseUrl).toBe("https://cli.phoenix.com");
      expect(config.apiKey).toBe("cli-key");
      expect(config.limit).toBe(2000);
      expect(config.stream).toBe(false);
      expect(config.mode).toBe("local");
      expect(config.refresh).toBe(true);
      expect(config.trace).toBe(true);
    });

    it("should convert --local flag to mode: local", async () => {
      const enoentError = new Error("File not found") as NodeJS.ErrnoException;
      enoentError.code = "ENOENT";
      vi.mocked(fs.readFile).mockRejectedValue(enoentError);
      vi.mocked(fs.access).mockRejectedValue(enoentError);
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      const config = await initializeConfig({ local: true });

      expect(config.mode).toBe("local");
    });

    it("should keep mode: sandbox when --local is false", async () => {
      const enoentError = new Error("File not found") as NodeJS.ErrnoException;
      enoentError.code = "ENOENT";
      vi.mocked(fs.readFile).mockRejectedValue(enoentError);
      vi.mocked(fs.access).mockRejectedValue(enoentError);
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      const config = await initializeConfig({ local: false });

      expect(config.mode).toBe("sandbox");
    });
  });

  describe("getConfig", () => {
    it("should throw error when config not initialized", () => {
      expect(() => getConfig()).toThrow(
        "Config not initialized. Call initializeConfig() first before using getConfig()."
      );
    });

    it("should return config after initialization", async () => {
      const enoentError = new Error("File not found") as NodeJS.ErrnoException;
      enoentError.code = "ENOENT";
      vi.mocked(fs.readFile).mockRejectedValue(enoentError);
      vi.mocked(fs.access).mockRejectedValue(enoentError);
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      await initializeConfig();
      const config = getConfig();

      expect(config).toEqual(getDefaultConfig());
    });

    it("should return same config instance on multiple calls", async () => {
      const enoentError = new Error("File not found") as NodeJS.ErrnoException;
      enoentError.code = "ENOENT";
      vi.mocked(fs.readFile).mockRejectedValue(enoentError);
      vi.mocked(fs.access).mockRejectedValue(enoentError);
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      await initializeConfig();
      const config1 = getConfig();
      const config2 = getConfig();

      expect(config1).toBe(config2);
    });
  });

  describe("resetConfig", () => {
    it("should reset config to uninitialized state", async () => {
      const enoentError = new Error("File not found") as NodeJS.ErrnoException;
      enoentError.code = "ENOENT";
      vi.mocked(fs.readFile).mockRejectedValue(enoentError);
      vi.mocked(fs.access).mockRejectedValue(enoentError);
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      await initializeConfig();
      expect(() => getConfig()).not.toThrow();

      resetConfig();
      expect(() => getConfig()).toThrow();
    });
  });

  describe("environment variable parsing", () => {
    beforeEach(() => {
      const enoentError = new Error("File not found") as NodeJS.ErrnoException;
      enoentError.code = "ENOENT";
      vi.mocked(fs.readFile).mockRejectedValue(enoentError);
      vi.mocked(fs.access).mockRejectedValue(enoentError);
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);
    });

    it("should parse PHOENIX_BASE_URL", async () => {
      process.env.PHOENIX_BASE_URL = "https://env.phoenix.com";
      const config = await initializeConfig();
      expect(config.baseUrl).toBe("https://env.phoenix.com");
    });

    it("should parse PHOENIX_API_KEY", async () => {
      process.env.PHOENIX_API_KEY = "env-api-key";
      const config = await initializeConfig();
      expect(config.apiKey).toBe("env-api-key");
    });

    it("should parse PHOENIX_INSIGHT_LIMIT as number", async () => {
      process.env.PHOENIX_INSIGHT_LIMIT = "2500";
      const config = await initializeConfig();
      expect(config.limit).toBe(2500);
    });

    it("should ignore invalid PHOENIX_INSIGHT_LIMIT", async () => {
      process.env.PHOENIX_INSIGHT_LIMIT = "not-a-number";
      const config = await initializeConfig();
      expect(config.limit).toBe(1000); // Default
    });

    it("should parse PHOENIX_INSIGHT_STREAM=true", async () => {
      process.env.PHOENIX_INSIGHT_STREAM = "true";
      const config = await initializeConfig();
      expect(config.stream).toBe(true);
    });

    it("should parse PHOENIX_INSIGHT_STREAM=false", async () => {
      process.env.PHOENIX_INSIGHT_STREAM = "false";
      const config = await initializeConfig();
      expect(config.stream).toBe(false);
    });

    it("should parse PHOENIX_INSIGHT_STREAM=1 as true", async () => {
      process.env.PHOENIX_INSIGHT_STREAM = "1";
      const config = await initializeConfig();
      expect(config.stream).toBe(true);
    });

    it("should parse PHOENIX_INSIGHT_MODE=local", async () => {
      process.env.PHOENIX_INSIGHT_MODE = "local";
      const config = await initializeConfig();
      expect(config.mode).toBe("local");
    });

    it("should parse PHOENIX_INSIGHT_MODE=sandbox", async () => {
      process.env.PHOENIX_INSIGHT_MODE = "sandbox";
      const config = await initializeConfig();
      expect(config.mode).toBe("sandbox");
    });

    it("should ignore invalid PHOENIX_INSIGHT_MODE", async () => {
      process.env.PHOENIX_INSIGHT_MODE = "invalid";
      const config = await initializeConfig();
      expect(config.mode).toBe("sandbox"); // Default
    });

    it("should parse PHOENIX_INSIGHT_REFRESH=true", async () => {
      process.env.PHOENIX_INSIGHT_REFRESH = "true";
      const config = await initializeConfig();
      expect(config.refresh).toBe(true);
    });

    it("should parse PHOENIX_INSIGHT_TRACE=true", async () => {
      process.env.PHOENIX_INSIGHT_TRACE = "true";
      const config = await initializeConfig();
      expect(config.trace).toBe(true);
    });
  });

  describe("config priority order", () => {
    it("should have correct priority: file < env < cli", async () => {
      // File has all values
      const fileConfig = {
        baseUrl: "https://file.phoenix.com",
        apiKey: "file-key",
        limit: 100,
        stream: false,
        mode: "local",
        refresh: false,
        trace: false,
      };
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(fileConfig));

      // Env overrides some values
      process.env.PHOENIX_BASE_URL = "https://env.phoenix.com";
      process.env.PHOENIX_API_KEY = "env-key";
      process.env.PHOENIX_INSIGHT_LIMIT = "500";

      // CLI overrides one more value
      const cliArgs: CliArgs = {
        baseUrl: "https://cli.phoenix.com",
      };

      const config = await initializeConfig(cliArgs);

      // CLI wins
      expect(config.baseUrl).toBe("https://cli.phoenix.com");
      // Env wins over file
      expect(config.apiKey).toBe("env-key");
      expect(config.limit).toBe(500);
      // File values kept where no override
      expect(config.stream).toBe(false);
      expect(config.mode).toBe("local");
      expect(config.refresh).toBe(false);
      expect(config.trace).toBe(false);
    });
  });

  describe("custom config path", () => {
    it("should use custom config path from CLI args", async () => {
      const customConfig = {
        baseUrl: "https://custom-path.phoenix.com",
      };
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(customConfig));

      const config = await initializeConfig({ config: "/custom/config.json" });

      expect(config.baseUrl).toBe("https://custom-path.phoenix.com");
      expect(fs.readFile).toHaveBeenCalledWith("/custom/config.json", "utf-8");
    });

    it("should not create default config for custom path", async () => {
      const enoentError = new Error("File not found") as NodeJS.ErrnoException;
      enoentError.code = "ENOENT";
      vi.mocked(fs.readFile).mockRejectedValue(enoentError);

      await initializeConfig({ config: "/custom/config.json" });

      // Should not try to create config at custom path
      expect(fs.writeFile).not.toHaveBeenCalled();
    });
  });
});
