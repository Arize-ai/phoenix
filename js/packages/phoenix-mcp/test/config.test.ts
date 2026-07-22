import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import {
  clearEnvFileCache,
  resetCrossTierEndpointWarningsForTesting,
} from "@arizeai/phoenix-config";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  DEFAULT_PHOENIX_ENDPOINT,
  loadConfigFromEnvironment,
  resolveConfig,
} from "../src/config";

describe("resolveConfig", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    clearEnvFileCache();
  });

  it("uses command-line options over environment-derived defaults", () => {
    vi.stubEnv("PHOENIX_HOST", "https://env.example.com");
    vi.stubEnv("PHOENIX_API_KEY", "env-key");
    vi.stubEnv("PHOENIX_PROJECT", "env-project");

    const config = resolveConfig({
      commandLineOptions: {
        apiKey: "cli-key",
        baseUrl: "https://cli.example.com",
        project: "cli-project",
      },
    });

    expect(config).toEqual({
      apiKey: "cli-key",
      baseUrl: "https://cli.example.com",
      project: "cli-project",
    });
  });

  it("falls back to the default Phoenix endpoint", () => {
    vi.stubEnv("PHOENIX_HOST", "");
    vi.stubEnv("PHOENIX_API_KEY", "");
    vi.stubEnv("PHOENIX_PROJECT", "");

    const config = resolveConfig({
      commandLineOptions: {},
    });

    expect(config.baseUrl).toBe(DEFAULT_PHOENIX_ENDPOINT);
  });

  it("ignores bare boolean CLI flags and keeps environment defaults", () => {
    vi.stubEnv("PHOENIX_HOST", "https://env.example.com");
    vi.stubEnv("PHOENIX_API_KEY", "env-key");
    vi.stubEnv("PHOENIX_PROJECT", "env-project");

    const config = resolveConfig({
      commandLineOptions: {
        apiKey: true,
        baseUrl: true,
        project: true,
      },
    });

    expect(config).toEqual({
      apiKey: "env-key",
      baseUrl: "https://env.example.com",
      project: "env-project",
    });
  });

  it("reads the project from the PHOENIX_PROJECT_NAME alias", () => {
    vi.stubEnv("PHOENIX_PROJECT_NAME", "alias-project");

    const config = loadConfigFromEnvironment();

    expect(config.project).toBe("alias-project");
  });

  it("warns while retaining a file endpoint and command-line API key", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "phoenix-mcp-env-"));
    const filePath = path.join(tempDir, ".env.phoenix");
    fs.writeFileSync(filePath, "PHOENIX_HOST=http://file-host:6006\n");
    vi.stubEnv("PHOENIX_DISCOVER_CONFIG", "true");
    vi.spyOn(process, "cwd").mockReturnValue(tempDir);
    clearEnvFileCache();
    resetCrossTierEndpointWarningsForTesting();
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    try {
      const config = resolveConfig({
        commandLineOptions: { apiKey: "secret-cli-key" },
      });

      expect(config).toMatchObject({
        apiKey: "secret-cli-key",
        baseUrl: "http://file-host:6006",
      });
      expect(warnSpy).toHaveBeenCalledWith(
        `Credentials from command-line options will be sent to PHOENIX_HOST set by ${filePath}.`
      );
      expect(warnSpy.mock.calls[0]?.[0]).not.toContain("secret-cli-key");
    } finally {
      fs.rmSync(tempDir, { force: true, recursive: true });
    }
  });

  it("prefers PHOENIX_PROJECT over PHOENIX_PROJECT_NAME", () => {
    vi.stubEnv("PHOENIX_PROJECT", "canonical-project");
    vi.stubEnv("PHOENIX_PROJECT_NAME", "alias-project");

    const config = loadConfigFromEnvironment();

    expect(config.project).toBe("canonical-project");
  });

  it("loads headers from the shared phoenix config helpers", () => {
    vi.stubEnv("PHOENIX_CLIENT_HEADERS", '{"X-Test":"value"}');

    const config = loadConfigFromEnvironment();

    expect(config.headers).toEqual({
      "X-Test": "value",
    });
  });
});
