import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import {
  getConfigPath,
  loadConfigFile,
  validateConfig,
  createDefaultConfig,
  setCliConfigPath,
} from "../../src/config/loader";
import { getDefaultConfig } from "../../src/config/schema";

// Mock fs module
vi.mock("node:fs/promises");

describe("config loader", () => {
  let originalEnv: NodeJS.ProcessEnv;
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Save original env
    originalEnv = { ...process.env };
    // Clear relevant env vars
    delete process.env.PHOENIX_INSIGHT_CONFIG;
    // Reset CLI config path
    setCliConfigPath(undefined);
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
  });

  describe("getConfigPath", () => {
    it("should return default path when no config specified", () => {
      const result = getConfigPath();
      const expectedPath = path.join(
        os.homedir(),
        ".phoenix-insight",
        "config.json"
      );

      expect(result.path).toBe(expectedPath);
      expect(result.isDefault).toBe(true);
    });

    it("should return CLI path when set via setCliConfigPath", () => {
      const customPath = "/custom/path/config.json";
      setCliConfigPath(customPath);

      const result = getConfigPath();

      expect(result.path).toBe(customPath);
      expect(result.isDefault).toBe(false);
    });

    it("should return env var path when PHOENIX_INSIGHT_CONFIG is set", () => {
      process.env.PHOENIX_INSIGHT_CONFIG = "/env/path/config.json";

      const result = getConfigPath();

      expect(result.path).toBe("/env/path/config.json");
      expect(result.isDefault).toBe(false);
    });

    it("should prioritize CLI path over env var", () => {
      process.env.PHOENIX_INSIGHT_CONFIG = "/env/path/config.json";
      setCliConfigPath("/cli/path/config.json");

      const result = getConfigPath();

      expect(result.path).toBe("/cli/path/config.json");
      expect(result.isDefault).toBe(false);
    });

    it("should prioritize env var over default path", () => {
      process.env.PHOENIX_INSIGHT_CONFIG = "/env/path/config.json";

      const result = getConfigPath();

      expect(result.path).toBe("/env/path/config.json");
      expect(result.isDefault).toBe(false);
    });
  });

  describe("loadConfigFile", () => {
    it("should load and parse valid JSON config file", async () => {
      const mockConfig = {
        baseUrl: "https://custom.phoenix.com",
        limit: 500,
      };
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockConfig));

      const result = await loadConfigFile("/path/to/config.json");

      expect(result).toEqual(mockConfig);
      expect(fs.readFile).toHaveBeenCalledWith("/path/to/config.json", "utf-8");
    });

    it("should return null when file not found", async () => {
      const enoentError = new Error("File not found") as NodeJS.ErrnoException;
      enoentError.code = "ENOENT";
      vi.mocked(fs.readFile).mockRejectedValue(enoentError);

      const result = await loadConfigFile("/nonexistent/config.json");

      expect(result).toBeNull();
      // Should not warn for expected "file not found" case
      expect(warnSpy).not.toHaveBeenCalled();
    });

    it("should return null and warn on invalid JSON", async () => {
      vi.mocked(fs.readFile).mockResolvedValue("{ invalid json }");

      const result = await loadConfigFile("/path/to/bad.json");

      expect(result).toBeNull();
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("invalid JSON")
      );
    });

    it("should return null and warn on permission errors", async () => {
      const permError = new Error("Permission denied") as NodeJS.ErrnoException;
      permError.code = "EACCES";
      vi.mocked(fs.readFile).mockRejectedValue(permError);

      const result = await loadConfigFile("/protected/config.json");

      expect(result).toBeNull();
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("Could not read config file")
      );
    });
  });

  describe("validateConfig", () => {
    it("should return defaults when raw is null", () => {
      const result = validateConfig(null);
      const defaults = getDefaultConfig();

      expect(result).toEqual(defaults);
    });

    it("should return defaults when raw is undefined", () => {
      const result = validateConfig(undefined);
      const defaults = getDefaultConfig();

      expect(result).toEqual(defaults);
    });

    it("should validate and return config with defaults applied", () => {
      const raw = { baseUrl: "https://custom.com" };

      const result = validateConfig(raw);

      expect(result.baseUrl).toBe("https://custom.com");
      // Check defaults are applied
      expect(result.limit).toBe(1000);
      expect(result.stream).toBe(true);
      expect(result.mode).toBe("sandbox");
    });

    it("should validate full config object", () => {
      const raw = {
        baseUrl: "https://phoenix.example.com",
        apiKey: "test-key",
        limit: 500,
        stream: false,
        mode: "local",
        refresh: true,
        trace: true,
      };

      const result = validateConfig(raw);

      expect(result).toEqual(raw);
    });

    it("should warn and return defaults on invalid config", () => {
      const raw = {
        limit: -100, // Invalid: must be positive
      };

      const result = validateConfig(raw);
      const defaults = getDefaultConfig();

      expect(result).toEqual(defaults);
      expect(warnSpy).toHaveBeenCalled();
    });

    it("should warn and return defaults on invalid mode", () => {
      const raw = {
        mode: "invalid-mode",
      };

      const result = validateConfig(raw);
      const defaults = getDefaultConfig();

      expect(result).toEqual(defaults);
      expect(warnSpy).toHaveBeenCalled();
    });

    it("should strip unknown properties", () => {
      const raw = {
        baseUrl: "https://custom.com",
        unknownField: "should be stripped",
      };

      const result = validateConfig(raw);

      expect(result.baseUrl).toBe("https://custom.com");
      expect((result as any).unknownField).toBeUndefined();
    });
  });

  describe("createDefaultConfig", () => {
    it("should not create config for non-default path", async () => {
      const result = await createDefaultConfig(
        "/custom/path/config.json",
        false
      );

      expect(result).toBe(false);
      expect(fs.writeFile).not.toHaveBeenCalled();
    });

    it("should not overwrite existing config file", async () => {
      vi.mocked(fs.access).mockResolvedValue(undefined);

      const result = await createDefaultConfig(
        path.join(os.homedir(), ".phoenix-insight", "config.json"),
        true
      );

      expect(result).toBe(false);
      expect(fs.writeFile).not.toHaveBeenCalled();
    });

    it("should create config file when it does not exist", async () => {
      const enoentError = new Error("File not found") as NodeJS.ErrnoException;
      enoentError.code = "ENOENT";
      vi.mocked(fs.access).mockRejectedValue(enoentError);
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      const configPath = path.join(
        os.homedir(),
        ".phoenix-insight",
        "config.json"
      );
      const result = await createDefaultConfig(configPath, true);

      expect(result).toBe(true);
      expect(fs.mkdir).toHaveBeenCalledWith(
        path.join(os.homedir(), ".phoenix-insight"),
        { recursive: true }
      );
      expect(fs.writeFile).toHaveBeenCalledWith(
        configPath,
        expect.any(String),
        "utf-8"
      );
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining("Created default config at")
      );
    });

    it("should write config with all default values", async () => {
      const enoentError = new Error("File not found") as NodeJS.ErrnoException;
      enoentError.code = "ENOENT";
      vi.mocked(fs.access).mockRejectedValue(enoentError);
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      const configPath = path.join(
        os.homedir(),
        ".phoenix-insight",
        "config.json"
      );
      await createDefaultConfig(configPath, true);

      // Verify the written content contains default values
      const writeCall = vi.mocked(fs.writeFile).mock.calls[0];
      const writtenContent = writeCall?.[1] as string;
      const writtenConfig = JSON.parse(writtenContent);

      expect(writtenConfig.baseUrl).toBe("http://localhost:6006");
      expect(writtenConfig.limit).toBe(1000);
      expect(writtenConfig.stream).toBe(true);
      expect(writtenConfig.mode).toBe("sandbox");
      expect(writtenConfig.refresh).toBe(false);
      expect(writtenConfig.trace).toBe(false);
    });

    it("should handle directory creation errors gracefully", async () => {
      const enoentError = new Error("File not found") as NodeJS.ErrnoException;
      enoentError.code = "ENOENT";
      vi.mocked(fs.access).mockRejectedValue(enoentError);
      vi.mocked(fs.mkdir).mockRejectedValue(new Error("Permission denied"));

      const configPath = path.join(
        os.homedir(),
        ".phoenix-insight",
        "config.json"
      );
      const result = await createDefaultConfig(configPath, true);

      expect(result).toBe(false);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("Could not create default config")
      );
    });

    it("should handle file write errors gracefully", async () => {
      const enoentError = new Error("File not found") as NodeJS.ErrnoException;
      enoentError.code = "ENOENT";
      vi.mocked(fs.access).mockRejectedValue(enoentError);
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockRejectedValue(new Error("Disk full"));

      const configPath = path.join(
        os.homedir(),
        ".phoenix-insight",
        "config.json"
      );
      const result = await createDefaultConfig(configPath, true);

      expect(result).toBe(false);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("Could not create default config")
      );
    });
  });

  describe("integration: config path priority", () => {
    it("should have correct priority order: CLI > env > default", () => {
      // Test 1: All three set - CLI wins
      process.env.PHOENIX_INSIGHT_CONFIG = "/env/config.json";
      setCliConfigPath("/cli/config.json");
      expect(getConfigPath().path).toBe("/cli/config.json");

      // Test 2: Only env set - env wins
      setCliConfigPath(undefined);
      expect(getConfigPath().path).toBe("/env/config.json");

      // Test 3: Nothing set - default wins
      delete process.env.PHOENIX_INSIGHT_CONFIG;
      const result = getConfigPath();
      expect(result.path).toBe(
        path.join(os.homedir(), ".phoenix-insight", "config.json")
      );
      expect(result.isDefault).toBe(true);
    });
  });
});
