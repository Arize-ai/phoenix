import { obscureApiKey } from "../src/commands/auth";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

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

    expect(config.endpoint).toBeUndefined();
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
