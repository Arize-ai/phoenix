import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { CommanderError } from "commander";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createAuthCommand,
  type FetchViewerResult,
  formatAuthStatus,
  obscureApiKey,
} from "../src/commands/auth";
import { type SettingsFile, saveSettings } from "../src/settings";

describe("Auth Commands", () => {
  describe("obscureApiKey", () => {
    it("should return asterisks for any API key", () => {
      const apiKey =
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiIxMjM0NTY3ODkwIn0.abc123";
      const obscured = obscureApiKey(apiKey);

      expect(obscured).toBe("************************************");
    });

    it("should return asterisks for short keys", () => {
      const shortKey = "abc";
      const obscured = obscureApiKey(shortKey);

      expect(obscured).toBe("************************************");
    });

    it("should handle empty string", () => {
      const emptyKey = "";
      const obscured = obscureApiKey(emptyKey);

      expect(obscured).toBe("");
    });

    it("should return fixed length asterisks regardless of input length", () => {
      const key1 = "short";
      const key2 = "a-very-long-api-key-that-is-much-longer-than-the-mask";

      expect(obscureApiKey(key1)).toBe(obscureApiKey(key2));
      expect(obscureApiKey(key1)).toBe("************************************");
    });
  });

  describe("Auth Status", () => {
    let originalEnv: NodeJS.ProcessEnv;

    beforeEach(() => {
      // Save original environment
      originalEnv = { ...process.env };

      // Clear environment variables
      delete process.env.PHOENIX_HOST;
      delete process.env.PHOENIX_API_KEY;
    });

    afterEach(() => {
      // Restore original environment
      process.env = originalEnv;
    });

    it("should detect when endpoint is configured from environment", async () => {
      process.env.PHOENIX_HOST = "http://localhost:6006";

      // Import after setting env vars
      const { resolveConfig } = await import("../src/config");

      const config = resolveConfig({ cliOptions: {} });

      expect(config.endpoint).toBe("http://localhost:6006");
    });

    it("should detect when API key is configured from environment", async () => {
      process.env.PHOENIX_HOST = "http://localhost:6006";
      process.env.PHOENIX_API_KEY = "test-api-key";

      // Import after setting env vars
      const { resolveConfig } = await import("../src/config");

      const config = resolveConfig({ cliOptions: {} });

      expect(config.endpoint).toBe("http://localhost:6006");
      expect(config.apiKey).toBe("test-api-key");
    });

    it("should prioritize CLI options over environment", async () => {
      process.env.PHOENIX_HOST = "http://env-host:6006";
      process.env.PHOENIX_API_KEY = "env-api-key";

      // Import after setting env vars
      const { resolveConfig } = await import("../src/config");

      const config = resolveConfig({
        cliOptions: {
          endpoint: "http://cli-host:6006",
          apiKey: "cli-api-key",
        },
      });

      expect(config.endpoint).toBe("http://cli-host:6006");
      expect(config.apiKey).toBe("cli-api-key");
    });

    it("should handle missing endpoint", async () => {
      // No PHOENIX_HOST set

      const { resolveConfig } = await import("../src/config");

      const config = resolveConfig({ cliOptions: {} });

      expect(config.endpoint).toBe("http://localhost:6006");
    });

    it("should handle missing API key (anonymous access)", async () => {
      process.env.PHOENIX_HOST = "http://localhost:6006";
      // No PHOENIX_API_KEY set

      const { resolveConfig } = await import("../src/config");

      const config = resolveConfig({ cliOptions: {} });

      expect(config.endpoint).toBe("http://localhost:6006");
      expect(config.apiKey).toBeUndefined();
    });
  });

  describe("formatAuthStatus", () => {
    const endpoint = "http://localhost:6006";
    const apiKey = "test-api-key";

    it("should format authenticated LOCAL user", () => {
      const result: FetchViewerResult = {
        status: "success",
        user: {
          auth_method: "LOCAL",
          username: "mikeldking",
          email: "mike@example.com",
          role: "ADMIN",
          id: "VXNlcjox",
          created_at: "2025-01-01T00:00:00Z",
          updated_at: "2025-01-01T00:00:00Z",
          password_needs_reset: false,
        },
      };

      const output = formatAuthStatus(endpoint, result, apiKey);

      expect(output).toContain(endpoint);
      expect(output).toContain("✓ Logged in as mikeldking (api key)");
      expect(output).not.toContain("Auth method");
      expect(output).toContain("Role: ADMIN");
      expect(output).toContain("Token: ****");
    });

    it("should format authenticated OAUTH2 user", () => {
      const result: FetchViewerResult = {
        status: "success",
        user: {
          auth_method: "OAUTH2",
          username: "oauthuser",
          email: "oauth@example.com",
          role: "MEMBER",
          id: "VXNlcjoy",
          created_at: "2025-01-01T00:00:00Z",
          updated_at: "2025-01-01T00:00:00Z",
        },
      };

      const output = formatAuthStatus(endpoint, result, apiKey);

      expect(output).toContain("✓ Logged in as oauthuser (api key)");
      expect(output).toContain("Role: MEMBER");
    });

    it("should format authenticated LDAP user", () => {
      const result: FetchViewerResult = {
        status: "success",
        user: {
          auth_method: "LDAP",
          username: "ldapuser",
          email: "ldap@example.com",
          role: "VIEWER",
          id: "VXNlcjoz",
          created_at: "2025-01-01T00:00:00Z",
          updated_at: "2025-01-01T00:00:00Z",
        },
      };

      const output = formatAuthStatus(endpoint, result, apiKey);

      expect(output).toContain("✓ Logged in as ldapuser (api key)");
      expect(output).toContain("Role: VIEWER");
    });

    it("should format anonymous user without token", () => {
      const result: FetchViewerResult = {
        status: "success",
        user: {
          auth_method: "ANONYMOUS",
        },
      };

      const output = formatAuthStatus(endpoint, result);

      expect(output).toContain("✓ Authentication not required (anonymous)");
      expect(output).not.toContain("Token:");
    });

    it("should format anonymous user with token configured", () => {
      const result: FetchViewerResult = {
        status: "success",
        user: {
          auth_method: "ANONYMOUS",
        },
      };

      const output = formatAuthStatus(endpoint, result, apiKey);

      expect(output).toContain("✓ Authentication not required (anonymous)");
      expect(output).toContain("Token: ****");
    });

    it("should format auth error with token", () => {
      const result: FetchViewerResult = {
        status: "auth_error",
        message: "401 Unauthorized",
      };

      const output = formatAuthStatus(endpoint, result, apiKey);

      expect(output).toContain(
        "✗ Authentication failed (invalid or expired token)"
      );
      expect(output).toContain("Token: ****");
    });

    it("should format network error with token", () => {
      const result: FetchViewerResult = {
        status: "network_error",
        message: "fetch failed",
      };

      const output = formatAuthStatus(endpoint, result, apiKey);

      expect(output).toContain(
        "✗ Token configured but could not verify (server unreachable)"
      );
      expect(output).toContain("Token: ****");
    });

    it("should format network error without token", () => {
      const result: FetchViewerResult = {
        status: "network_error",
        message: "fetch failed",
      };

      const output = formatAuthStatus(endpoint, result);

      expect(output).toContain("✗ Could not connect to server");
      expect(output).not.toContain("Token:");
    });

    it("should format not_found (older server)", () => {
      const result: FetchViewerResult = {
        status: "not_found",
        message: "404 Not Found",
      };

      const output = formatAuthStatus(endpoint, result, apiKey);

      expect(output).toContain(
        "Could not verify token (server does not support user endpoint)"
      );
      expect(output).toContain("Token: ****");
    });

    it("should show endpoint as first line", () => {
      const result: FetchViewerResult = {
        status: "success",
        user: { auth_method: "ANONYMOUS" },
      };

      const output = formatAuthStatus(endpoint, result);
      const lines = output.split("\n");

      expect(lines[0]).toBe(endpoint);
    });

    it("should include profile name line when profileName is provided", () => {
      const result: FetchViewerResult = {
        status: "success",
        user: { auth_method: "ANONYMOUS" },
      };

      const output = formatAuthStatus(endpoint, result, undefined, "prod");

      expect(output).toContain("Profile: prod");
    });

    it("should not include profile line when profileName is omitted", () => {
      const result: FetchViewerResult = {
        status: "success",
        user: { auth_method: "ANONYMOUS" },
      };

      const output = formatAuthStatus(endpoint, result);

      expect(output).not.toContain("Profile:");
    });
  });
});

// ---------------------------------------------------------------------------
// Auth status command integration tests (helpers)
// ---------------------------------------------------------------------------

function writeTempSettings(tmpDir: string, data: SettingsFile): void {
  const pxDir = path.join(tmpDir, "px");
  fs.mkdirSync(pxDir, { recursive: true });
  saveSettings(data, { settingsPath: path.join(pxDir, "settings.json") });
}

async function runAuthCommand(
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

  const cmd = createAuthCommand();
  // Commander exits on --help/version/parse errors; override so those don't
  // terminate the process. We re-throw anything that isn't a CommanderError
  // so that process.exit mock throws (from error-path handlers) propagate to
  // the test and can be asserted on with .rejects.toThrow().
  cmd.exitOverride();
  try {
    await cmd.parseAsync(["node", "px", ...args]);
  } catch (err) {
    if (err instanceof CommanderError) {
      // Commander parse/help errors — swallow, caller inspects spies.
      return;
    }
    // process.exit mock throws an Error — re-throw so callers using
    // .rejects.toThrow() see a rejection.
    throw err;
  }
}


// ---------------------------------------------------------------------------
// Auth status command integration tests
// ---------------------------------------------------------------------------

describe("auth status command integration", () => {
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

    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "phoenix-status-int-"));
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

  it("--profile nonexistent exits with error containing the profile name", async () => {
    writeTempSettings(tmpDir, {
      activeProfile: null,
      profiles: { dev: { endpoint: "http://localhost:6006" } },
    });
    process.env.PHOENIX_HOST = "http://localhost:6006";

    await expect(
      runAuthCommand(["status", "--profile", "nonexistent"], {
        logSpy,
        errorSpy,
        exitSpy,
      })
    ).rejects.toThrow();

    const errOutput = errorSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(errOutput).toContain("nonexistent");
  });
});
