import * as fs from "fs";
import * as http from "http";
import * as os from "os";
import * as path from "path";
import { PassThrough } from "stream";
import { CommanderError } from "commander";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  type FetchViewerResult,
  createAuthCommand,
  formatAuthStatus,
  obscureApiKey,
} from "../src/commands/auth";
import { ExitCode } from "../src/exitCodes";
import type { SettingsFile } from "../src/settings";
import { mockProcessExit } from "./testUtils";

function readRequestBody(request: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk: Buffer) => chunks.push(chunk));
    request.on("error", reject);
    request.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
  });
}

async function withServer(
  handler: http.RequestListener
): Promise<{ url: string; close: () => Promise<void> }> {
  const server = http.createServer(handler);
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });
  const address = server.address();
  if (address === null || typeof address === "string") {
    throw new Error("Server did not bind to a TCP port.");
  }
  return {
    url: `http://127.0.0.1:${address.port}`,
    close: () =>
      new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  };
}

function writeTempSettings(tmpDir: string, data: SettingsFile): void {
  const pxDir = path.join(tmpDir, "px");
  fs.mkdirSync(pxDir, { recursive: true });
  fs.writeFileSync(
    path.join(pxDir, "settings.json"),
    JSON.stringify(data, null, 2),
    "utf-8"
  );
}

function readTempSettings(tmpDir: string): SettingsFile {
  const settings: SettingsFile = JSON.parse(
    fs.readFileSync(path.join(tmpDir, "px", "settings.json"), "utf-8")
  );
  return settings;
}

function captured(spy: ReturnType<typeof vi.spyOn>): string {
  return spy.mock.calls.map((call) => String(call[0])).join("\n");
}

function respondWithOAuthDiscovery(response: http.ServerResponse): void {
  response.writeHead(200, { "Content-Type": "application/json" });
  response.end(
    JSON.stringify({
      issuer: "http://phoenix.example",
      authorization_endpoint: "http://phoenix.example/oauth2/authorize",
      token_endpoint: "http://phoenix.example/oauth2/token",
    })
  );
}

async function runAuthCommand(args: string[]): Promise<void> {
  const command = createAuthCommand();
  command.exitOverride();
  try {
    await command.parseAsync(args, { from: "user" });
  } catch (error) {
    if (error instanceof CommanderError) {
      return;
    }
    if (error instanceof Error && /^process\.exit/.test(error.message)) {
      return;
    }
    throw error;
  }
}

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
      expect(output).toContain("✓ Logged in as mikeldking (profile api key)");
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

      expect(output).toContain("✓ Logged in as oauthuser (profile api key)");
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

      expect(output).toContain("✓ Logged in as ldapuser (profile api key)");
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

    it("includes the profile name line when a profile is active", () => {
      const result: FetchViewerResult = {
        status: "success",
        user: { auth_method: "ANONYMOUS" },
      };
      const output = formatAuthStatus(endpoint, result, undefined, "prod");
      expect(output).toContain("Profile: prod");
    });

    it("reports OAuth expiry", () => {
      const result: FetchViewerResult = {
        status: "success",
        user: {
          auth_method: "LOCAL",
          username: "oauth-user",
          email: "oauth@example.com",
          role: "MEMBER",
          id: "VXNlcjox",
          created_at: "2026-01-01T00:00:00Z",
          updated_at: "2026-01-01T00:00:00Z",
          password_needs_reset: false,
        },
      };
      const output = formatAuthStatus(
        endpoint,
        result,
        undefined,
        "prod",
        "oauth",
        {
          accessToken: "access",
          refreshToken: "refresh",
          expiresAt: "2026-01-01T00:10:00.000Z",
          scope: "",
        }
      );
      expect(output).toContain("Logged in as oauth-user (oauth)");
      expect(output).toContain("Expires: 2026-01-01T00:10:00.000Z");
    });

    it("formats status as raw JSON", () => {
      const result: FetchViewerResult = {
        status: "success",
        user: { auth_method: "ANONYMOUS" },
      };
      const parsed: { endpoint: string; profile: string; status: string } =
        JSON.parse(
          formatAuthStatus(
            endpoint,
            result,
            undefined,
            "prod",
            "none",
            undefined,
            "raw"
          )
        );
      expect(parsed).toEqual({
        endpoint,
        profile: "prod",
        credentialSource: "none",
        status: "anonymous",
        user: { auth_method: "ANONYMOUS" },
      });
    });
  });
});

describe("px auth login/logout", () => {
  let originalEnv: NodeJS.ProcessEnv;
  let tmpDir: string;
  let originalStdin: typeof process.stdin;

  beforeEach(() => {
    originalEnv = { ...process.env };
    originalStdin = process.stdin;
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "phoenix-auth-test-"));
    process.env.XDG_CONFIG_HOME = tmpDir;
    delete process.env.PHOENIX_HOST;
    delete process.env.PHOENIX_API_KEY;
  });

  afterEach(() => {
    Object.defineProperty(process, "stdin", {
      value: originalStdin,
      configurable: true,
    });
    process.env = originalEnv;
    fs.rmSync(tmpDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it("logs in via pasted redirect URL against stubbed endpoints", async () => {
    let server: Awaited<ReturnType<typeof withServer>> | undefined;
    try {
      writeTempSettings(tmpDir, {
        activeProfile: "default",
        profiles: {
          default: {
            endpoint: "http://old-phoenix.example.com",
          },
        },
      });
      server = await withServer(async (request, response) => {
        if (request.url === "/.well-known/oauth-authorization-server") {
          respondWithOAuthDiscovery(response);
          return;
        }
        if (request.url === "/oauth2/token" && request.method === "POST") {
          const body = new URLSearchParams(await readRequestBody(request));
          expect(body.get("grant_type")).toBe("authorization_code");
          expect(body.get("client_id")).toBe("phoenix-cli");
          expect(body.get("code")).toBe("code-123");
          response.writeHead(200, { "Content-Type": "application/json" });
          response.end(
            JSON.stringify({
              access_token: "access-token",
              refresh_token: "refresh-token",
              expires_in: 600,
              token_type: "Bearer",
            })
          );
          return;
        }
        if (request.url === "/v1/user") {
          expect(request.headers.authorization).toBe("Bearer access-token");
          response.writeHead(200, { "Content-Type": "application/json" });
          response.end(
            JSON.stringify({
              data: {
                auth_method: "LOCAL",
                username: "roger",
                email: "roger@example.com",
                role: "MEMBER",
                id: "VXNlcjox",
                created_at: "2026-01-01T00:00:00Z",
                updated_at: "2026-01-01T00:00:00Z",
                password_needs_reset: false,
              },
            })
          );
          return;
        }
        response.writeHead(404);
        response.end();
      });

      const stdin = new PassThrough();
      Object.defineProperty(process, "stdin", {
        value: stdin,
        configurable: true,
      });
      const stdoutSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const stderrSpy = vi
        .spyOn(console, "error")
        .mockImplementation((message) => {
          const text = String(message);
          const match = text.match(
            /http:\/\/127\.0\.0\.1:\d+\/oauth2\/authorize\?[^\s]+/
          );
          if (match) {
            const authorizationUrl = new URL(match[0]);
            const state = authorizationUrl.searchParams.get("state");
            stdin.write(
              `http://127.0.0.1/callback?code=code-123&state=${state}\n`
            );
          }
        });

      await runAuthCommand([
        "login",
        "--endpoint",
        server.url,
        "--no-browser",
        "--format",
        "raw",
      ]);

      const output: {
        status: string;
        user: { username: string };
      } = JSON.parse(captured(stdoutSpy));
      expect(output.status).toBe("authenticated");
      expect(output.user.username).toBe("roger");
      expect(captured(stderrSpy)).toContain("/oauth2/authorize");
      const saved = readTempSettings(tmpDir);
      expect(saved.activeProfile).toBe("default");
      expect(saved.profiles.default.endpoint).toBe(server.url);
      expect(saved.profiles.default.oauthTokens?.refreshToken).toBe(
        "refresh-token"
      );
    } finally {
      await server?.close();
    }
  });

  it("maps token endpoint 404 to AUTH_REQUIRED with API key hint", async () => {
    let server: Awaited<ReturnType<typeof withServer>> | undefined;
    try {
      server = await withServer((request, response) => {
        if (request.url === "/.well-known/oauth-authorization-server") {
          respondWithOAuthDiscovery(response);
          return;
        }
        response.writeHead(404);
        response.end();
      });
      const stdin = new PassThrough();
      Object.defineProperty(process, "stdin", {
        value: stdin,
        configurable: true,
      });
      vi.spyOn(console, "log").mockImplementation(() => {});
      vi.spyOn(console, "error").mockImplementation((message) => {
        const match = String(message).match(
          /http:\/\/127\.0\.0\.1:\d+\/oauth2\/authorize\?[^\s]+/
        );
        if (match) {
          const authorizationUrl = new URL(match[0]);
          const state = authorizationUrl.searchParams.get("state");
          stdin.write(
            `http://127.0.0.1/callback?code=code-123&state=${state}\n`
          );
        }
      });
      const exitSpy = mockProcessExit();

      await expect(
        createAuthCommand().parseAsync(
          ["login", "--endpoint", server.url, "--no-browser"],
          { from: "user" }
        )
      ).rejects.toThrow(`process.exit:${ExitCode.AUTH_REQUIRED}`);
      expect(exitSpy).toHaveBeenCalledWith(ExitCode.AUTH_REQUIRED);
    } finally {
      await server?.close();
    }
  });

  it("bails with AUTH_REQUIRED before the flow when the server lacks OAuth discovery", async () => {
    let server: Awaited<ReturnType<typeof withServer>> | undefined;
    try {
      // A Phoenix without an authorization server answers unknown paths with
      // the SPA's index.html and a 200 — the trap the discovery gate exists
      // to catch.
      server = await withServer((_request, response) => {
        response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        response.end("<!doctype html><html><body>Phoenix</body></html>");
      });
      vi.spyOn(console, "log").mockImplementation(() => {});
      const stderrSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const exitSpy = mockProcessExit();

      await expect(
        createAuthCommand().parseAsync(
          ["login", "--endpoint", server.url, "--no-browser"],
          { from: "user" }
        )
      ).rejects.toThrow(`process.exit:${ExitCode.AUTH_REQUIRED}`);
      expect(exitSpy).toHaveBeenCalledWith(ExitCode.AUTH_REQUIRED);
      const stderr = captured(stderrSpy);
      expect(stderr).toContain("does not support OAuth login");
      // The gate must fire before the flow starts — no authorization URL.
      expect(stderr).not.toContain("/oauth2/authorize");
    } finally {
      await server?.close();
    }
  });

  it("treats a 5xx discovery response as unreachable, not as missing OAuth support", async () => {
    let server: Awaited<ReturnType<typeof withServer>> | undefined;
    try {
      server = await withServer((_request, response) => {
        response.writeHead(503);
        response.end();
      });
      vi.spyOn(console, "log").mockImplementation(() => {});
      const stderrSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const exitSpy = mockProcessExit();

      await expect(
        createAuthCommand().parseAsync(
          ["login", "--endpoint", server.url, "--no-browser"],
          { from: "user" }
        )
      ).rejects.toThrow(`process.exit:${ExitCode.NETWORK_ERROR}`);
      expect(exitSpy).toHaveBeenCalledWith(ExitCode.NETWORK_ERROR);
      expect(captured(stderrSpy)).toContain("HTTP 503");
    } finally {
      await server?.close();
    }
  });

  it("bails with NETWORK_ERROR before the flow when the server is unreachable", async () => {
    // Bind and immediately close a server so the port is known-dead.
    const server = await withServer((_request, response) => {
      response.end();
    });
    await server.close();

    vi.spyOn(console, "log").mockImplementation(() => {});
    const stderrSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const exitSpy = mockProcessExit();

    await expect(
      createAuthCommand().parseAsync(
        ["login", "--endpoint", server.url, "--no-browser"],
        { from: "user" }
      )
    ).rejects.toThrow(`process.exit:${ExitCode.NETWORK_ERROR}`);
    expect(exitSpy).toHaveBeenCalledWith(ExitCode.NETWORK_ERROR);
    const stderr = captured(stderrSpy);
    expect(stderr).toContain("Could not reach the Phoenix server");
    expect(stderr).not.toContain("/oauth2/authorize");
  });

  it("logout revokes the refresh token and leaves the API key", async () => {
    let revokeBody: URLSearchParams | undefined;
    let server: Awaited<ReturnType<typeof withServer>> | undefined;
    try {
      server = await withServer(async (request, response) => {
        if (request.url === "/oauth2/revoke") {
          revokeBody = new URLSearchParams(await readRequestBody(request));
        }
        response.writeHead(200);
        response.end();
      });
      writeTempSettings(tmpDir, {
        activeProfile: "prod",
        profiles: {
          prod: {
            endpoint: server.url,
            apiKey: "api-key",
            oauthTokens: {
              accessToken: "access",
              refreshToken: "refresh",
              expiresAt: "2026-01-01T00:00:00.000Z",
              scope: "",
            },
          },
        },
      });
      vi.spyOn(console, "log").mockImplementation(() => {});
      vi.spyOn(console, "error").mockImplementation(() => {});

      await runAuthCommand(["logout", "--profile", "prod", "--format", "raw"]);
      const saved = readTempSettings(tmpDir);
      expect(revokeBody?.get("token")).toBe("refresh");
      expect(saved.profiles.prod.apiKey).toBe("api-key");
      expect(saved.profiles.prod.oauthTokens).toBeUndefined();

      await runAuthCommand(["logout", "--profile", "prod", "--format", "raw"]);
      expect(readTempSettings(tmpDir).profiles.prod.apiKey).toBe("api-key");
    } finally {
      await server?.close();
    }
  });
});
