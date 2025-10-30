import { getMergedOptions } from "../src";
import { defaultGetEnvironmentOptions } from "../src/config";

import { beforeEach,describe, expect, it } from "vitest";

describe("Phoenix client configuration", () => {
  beforeEach(() => {
    // Reset process.env before each test
    process.env = {};
  });

  describe("environment parsing", () => {
    it("should handle empty environment", () => {
      const options = defaultGetEnvironmentOptions();
      expect(options).toEqual({});
    });

    it("should parse PHOENIX_HOST from environment", () => {
      process.env.PHOENIX_HOST = "https://test-host.com";
      const options = defaultGetEnvironmentOptions();
      expect(options).toEqual({
        baseUrl: "https://test-host.com",
      });
    });

    it("should parse PHOENIX_CLIENT_HEADERS from environment", () => {
      process.env.PHOENIX_CLIENT_HEADERS = JSON.stringify({
        "X-Custom-Header": "test-value",
      });
      const options = defaultGetEnvironmentOptions();
      expect(options).toEqual({
        headers: {
          "X-Custom-Header": "test-value",
        },
      });
    });
  });

  describe("configuration merging", () => {
    it("should use default options when no overrides provided", () => {
      const options = getMergedOptions({});
      expect(options.baseUrl).toBe("http://localhost:6006");
    });

    it("should override defaults with environment variables", () => {
      process.env.PHOENIX_HOST = "https://env-host.com";
      const options = getMergedOptions({});
      expect(options.baseUrl).toBe("https://env-host.com");
    });

    it("should override environment with explicit options", () => {
      process.env.PHOENIX_HOST = "https://env-host.com";
      const options = getMergedOptions({
        options: {
          baseUrl: "https://explicit-host.com",
        },
      });
      expect(options.baseUrl).toBe("https://explicit-host.com");
    });

    it("should replace headers correctly", () => {
      process.env.PHOENIX_CLIENT_HEADERS = JSON.stringify({
        "X-Env-Header": "env-value",
      });
      const options = getMergedOptions({
        options: {
          headers: {
            "X-Custom-Header": "custom-value",
          },
        },
      });
      expect(options.headers).toEqual({
        "X-Custom-Header": "custom-value",
      });
    });
  });
});
