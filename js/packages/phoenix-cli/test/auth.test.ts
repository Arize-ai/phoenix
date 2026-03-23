import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  type FetchViewerResult,
  formatAuthStatus,
  obscureApiKey,
} from "../src/commands/auth";

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
  });
});
