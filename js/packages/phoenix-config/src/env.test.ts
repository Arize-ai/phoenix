import {
  ENV_PHOENIX_API_KEY,
  ENV_PHOENIX_CLIENT_HEADERS,
  ENV_PHOENIX_COLLECTOR_ENDPOINT,
  ENV_PHOENIX_GRPC_PORT,
  ENV_PHOENIX_HOST,
  ENV_PHOENIX_PORT,
  type EnvironmentConfig,
  getEnvironmentConfig,
  getHeadersFromEnvironment,
  getIntFromEnvironment,
  getStrFromEnvironment,
} from "./env";
import type { Headers } from "./types";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

/**
 * Type assertion helpers to ensure no `any` types leak through.
 * These will cause compile-time errors if types are incorrect.
 */
type AssertEquals<T, Expected> = T extends Expected
  ? Expected extends T
    ? true
    : false
  : false;

// Compile-time type checks - these ensure our return types are well-defined
type _CheckIntReturn = AssertEquals<
  ReturnType<typeof getIntFromEnvironment>,
  number | undefined
>;
const _intReturnCheck: _CheckIntReturn = true;

type _CheckStrReturn = AssertEquals<
  ReturnType<typeof getStrFromEnvironment>,
  string | undefined
>;
const _strReturnCheck: _CheckStrReturn = true;

type _CheckHeadersReturn = AssertEquals<
  ReturnType<typeof getHeadersFromEnvironment>,
  Headers | undefined
>;
const _headersReturnCheck: _CheckHeadersReturn = true;

// Ensure EnvironmentConfig has well-defined property types (no `any`)
type _CheckConfigPort = AssertEquals<
  EnvironmentConfig["PHOENIX_PORT"],
  number | undefined
>;
const _configPortCheck: _CheckConfigPort = true;

type _CheckConfigGrpcPort = AssertEquals<
  EnvironmentConfig["PHOENIX_GRPC_PORT"],
  number | undefined
>;
const _configGrpcPortCheck: _CheckConfigGrpcPort = true;

type _CheckConfigHost = AssertEquals<
  EnvironmentConfig["PHOENIX_HOST"],
  string | undefined
>;
const _configHostCheck: _CheckConfigHost = true;

type _CheckConfigHeaders = AssertEquals<
  EnvironmentConfig["PHOENIX_CLIENT_HEADERS"],
  Headers | undefined
>;
const _configHeadersCheck: _CheckConfigHeaders = true;

type _CheckConfigEndpoint = AssertEquals<
  EnvironmentConfig["PHOENIX_COLLECTOR_ENDPOINT"],
  string | undefined
>;
const _configEndpointCheck: _CheckConfigEndpoint = true;

type _CheckConfigApiKey = AssertEquals<
  EnvironmentConfig["PHOENIX_API_KEY"],
  string | undefined
>;
const _configApiKeyCheck: _CheckConfigApiKey = true;

// Suppress unused variable warnings for type checks
void _intReturnCheck;
void _strReturnCheck;
void _headersReturnCheck;
void _configPortCheck;
void _configGrpcPortCheck;
void _configHostCheck;
void _configHeadersCheck;
void _configEndpointCheck;
void _configApiKeyCheck;

describe("env", () => {
  // Store original env values
  const originalEnv: Record<string, string | undefined> = {};
  const envKeys = [
    ENV_PHOENIX_PORT,
    ENV_PHOENIX_GRPC_PORT,
    ENV_PHOENIX_HOST,
    ENV_PHOENIX_CLIENT_HEADERS,
    ENV_PHOENIX_COLLECTOR_ENDPOINT,
    ENV_PHOENIX_API_KEY,
  ];

  beforeEach(() => {
    // Save and clear all Phoenix env vars before each test
    for (const key of envKeys) {
      originalEnv[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    // Restore original env vars after each test
    for (const key of envKeys) {
      if (originalEnv[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = originalEnv[key];
      }
    }
  });

  describe("environment variable constants", () => {
    it("should export correct environment variable names", () => {
      expect(ENV_PHOENIX_PORT).toBe("PHOENIX_PORT");
      expect(ENV_PHOENIX_GRPC_PORT).toBe("PHOENIX_GRPC_PORT");
      expect(ENV_PHOENIX_HOST).toBe("PHOENIX_HOST");
      expect(ENV_PHOENIX_CLIENT_HEADERS).toBe("PHOENIX_CLIENT_HEADERS");
      expect(ENV_PHOENIX_COLLECTOR_ENDPOINT).toBe("PHOENIX_COLLECTOR_ENDPOINT");
      expect(ENV_PHOENIX_API_KEY).toBe("PHOENIX_API_KEY");
    });
  });

  describe("getIntFromEnvironment", () => {
    it("should return undefined when env var is not set", () => {
      const result = getIntFromEnvironment("UNSET_VAR");
      expect(result).toBeUndefined();
    });

    it("should return undefined when env var is empty string", () => {
      process.env["EMPTY_VAR"] = "";
      const result = getIntFromEnvironment("EMPTY_VAR");
      expect(result).toBeUndefined();
      delete process.env["EMPTY_VAR"];
    });

    it("should parse valid integer string", () => {
      process.env[ENV_PHOENIX_PORT] = "6006";
      const result = getIntFromEnvironment(ENV_PHOENIX_PORT);
      expect(result).toBe(6006);
    });

    it("should parse zero", () => {
      process.env[ENV_PHOENIX_PORT] = "0";
      const result = getIntFromEnvironment(ENV_PHOENIX_PORT);
      expect(result).toBe(0);
    });

    it("should parse negative integers", () => {
      process.env[ENV_PHOENIX_PORT] = "-1";
      const result = getIntFromEnvironment(ENV_PHOENIX_PORT);
      expect(result).toBe(-1);
    });

    it("should return NaN for non-numeric strings", () => {
      process.env[ENV_PHOENIX_PORT] = "not-a-number";
      const result = getIntFromEnvironment(ENV_PHOENIX_PORT);
      expect(result).toBeNaN();
    });

    it("should parse integers with leading zeros", () => {
      process.env[ENV_PHOENIX_PORT] = "007";
      const result = getIntFromEnvironment(ENV_PHOENIX_PORT);
      expect(result).toBe(7);
    });

    it("should truncate floating point numbers", () => {
      process.env[ENV_PHOENIX_PORT] = "6006.5";
      const result = getIntFromEnvironment(ENV_PHOENIX_PORT);
      expect(result).toBe(6006);
    });
  });

  describe("getStrFromEnvironment", () => {
    it("should return undefined when env var is not set", () => {
      const result = getStrFromEnvironment("UNSET_VAR");
      expect(result).toBeUndefined();
    });

    it("should return empty string when env var is empty", () => {
      process.env["EMPTY_VAR"] = "";
      const result = getStrFromEnvironment("EMPTY_VAR");
      expect(result).toBe("");
      delete process.env["EMPTY_VAR"];
    });

    it("should return the string value", () => {
      process.env[ENV_PHOENIX_HOST] = "http://localhost:6006";
      const result = getStrFromEnvironment(ENV_PHOENIX_HOST);
      expect(result).toBe("http://localhost:6006");
    });

    it("should preserve whitespace", () => {
      process.env[ENV_PHOENIX_HOST] = "  spaced  ";
      const result = getStrFromEnvironment(ENV_PHOENIX_HOST);
      expect(result).toBe("  spaced  ");
    });
  });

  describe("getHeadersFromEnvironment", () => {
    it("should return undefined when env var is not set", () => {
      const result = getHeadersFromEnvironment("UNSET_VAR");
      expect(result).toBeUndefined();
    });

    it("should return undefined when env var is empty string", () => {
      process.env[ENV_PHOENIX_CLIENT_HEADERS] = "";
      const result = getHeadersFromEnvironment(ENV_PHOENIX_CLIENT_HEADERS);
      expect(result).toBeUndefined();
    });

    it("should parse valid JSON headers object", () => {
      const headers = { Authorization: "Bearer token", "X-Custom": "value" };
      process.env[ENV_PHOENIX_CLIENT_HEADERS] = JSON.stringify(headers);
      const result = getHeadersFromEnvironment(ENV_PHOENIX_CLIENT_HEADERS);
      expect(result).toEqual(headers);
    });

    it("should parse empty object", () => {
      process.env[ENV_PHOENIX_CLIENT_HEADERS] = "{}";
      const result = getHeadersFromEnvironment(ENV_PHOENIX_CLIENT_HEADERS);
      expect(result).toEqual({});
    });

    it("should return undefined for invalid JSON", () => {
      process.env[ENV_PHOENIX_CLIENT_HEADERS] = "not-json";
      const result = getHeadersFromEnvironment(ENV_PHOENIX_CLIENT_HEADERS);
      expect(result).toBeUndefined();
    });

    it("should return undefined for JSON array", () => {
      process.env[ENV_PHOENIX_CLIENT_HEADERS] = '["a", "b"]';
      const result = getHeadersFromEnvironment(ENV_PHOENIX_CLIENT_HEADERS);
      expect(result).toBeUndefined();
    });

    it("should return undefined for JSON with non-string values", () => {
      process.env[ENV_PHOENIX_CLIENT_HEADERS] = '{"key": 123}';
      const result = getHeadersFromEnvironment(ENV_PHOENIX_CLIENT_HEADERS);
      expect(result).toBeUndefined();
    });

    it("should return undefined for JSON with nested objects", () => {
      process.env[ENV_PHOENIX_CLIENT_HEADERS] = '{"key": {"nested": "value"}}';
      const result = getHeadersFromEnvironment(ENV_PHOENIX_CLIENT_HEADERS);
      expect(result).toBeUndefined();
    });

    it("should return undefined for JSON null", () => {
      process.env[ENV_PHOENIX_CLIENT_HEADERS] = "null";
      const result = getHeadersFromEnvironment(ENV_PHOENIX_CLIENT_HEADERS);
      expect(result).toBeUndefined();
    });

    it("should return undefined for JSON string primitive", () => {
      process.env[ENV_PHOENIX_CLIENT_HEADERS] = '"just a string"';
      const result = getHeadersFromEnvironment(ENV_PHOENIX_CLIENT_HEADERS);
      expect(result).toBeUndefined();
    });

    it("should return undefined for JSON with mixed value types", () => {
      process.env[ENV_PHOENIX_CLIENT_HEADERS] =
        '{"valid": "string", "invalid": true}';
      const result = getHeadersFromEnvironment(ENV_PHOENIX_CLIENT_HEADERS);
      expect(result).toBeUndefined();
    });
  });

  describe("getEnvironmentConfig", () => {
    it("should return all undefined values when no env vars are set", () => {
      const config = getEnvironmentConfig();

      expect(config).toEqual({
        PHOENIX_PORT: undefined,
        PHOENIX_GRPC_PORT: undefined,
        PHOENIX_HOST: undefined,
        PHOENIX_CLIENT_HEADERS: undefined,
        PHOENIX_COLLECTOR_ENDPOINT: undefined,
        PHOENIX_API_KEY: undefined,
      });
    });

    it("should return parsed values when env vars are set", () => {
      process.env[ENV_PHOENIX_PORT] = "6006";
      process.env[ENV_PHOENIX_GRPC_PORT] = "4317";
      process.env[ENV_PHOENIX_HOST] = "http://phoenix.local";
      process.env[ENV_PHOENIX_CLIENT_HEADERS] =
        '{"Authorization": "Bearer xyz"}';
      process.env[ENV_PHOENIX_COLLECTOR_ENDPOINT] = "http://collector.local";
      process.env[ENV_PHOENIX_API_KEY] = "my-api-key";

      const config = getEnvironmentConfig();

      expect(config).toEqual({
        PHOENIX_PORT: 6006,
        PHOENIX_GRPC_PORT: 4317,
        PHOENIX_HOST: "http://phoenix.local",
        PHOENIX_CLIENT_HEADERS: { Authorization: "Bearer xyz" },
        PHOENIX_COLLECTOR_ENDPOINT: "http://collector.local",
        PHOENIX_API_KEY: "my-api-key",
      });
    });

    it("should return partial config when some env vars are set", () => {
      process.env[ENV_PHOENIX_PORT] = "8080";
      process.env[ENV_PHOENIX_API_KEY] = "secret";

      const config = getEnvironmentConfig();

      expect(config.PHOENIX_PORT).toBe(8080);
      expect(config.PHOENIX_GRPC_PORT).toBeUndefined();
      expect(config.PHOENIX_HOST).toBeUndefined();
      expect(config.PHOENIX_CLIENT_HEADERS).toBeUndefined();
      expect(config.PHOENIX_COLLECTOR_ENDPOINT).toBeUndefined();
      expect(config.PHOENIX_API_KEY).toBe("secret");
    });

    it("should have correct property keys matching environment variable names", () => {
      const config = getEnvironmentConfig();
      const keys = Object.keys(config);

      expect(keys).toContain(ENV_PHOENIX_PORT);
      expect(keys).toContain(ENV_PHOENIX_GRPC_PORT);
      expect(keys).toContain(ENV_PHOENIX_HOST);
      expect(keys).toContain(ENV_PHOENIX_CLIENT_HEADERS);
      expect(keys).toContain(ENV_PHOENIX_COLLECTOR_ENDPOINT);
      expect(keys).toContain(ENV_PHOENIX_API_KEY);
      expect(keys).toHaveLength(6);
    });
  });

  describe("EnvironmentConfig type", () => {
    it("should allow typed access to config properties", () => {
      process.env[ENV_PHOENIX_PORT] = "6006";
      process.env[ENV_PHOENIX_CLIENT_HEADERS] = '{"X-Test": "value"}';

      const config: EnvironmentConfig = getEnvironmentConfig();

      // These type assertions verify the types are correct at compile time
      const port: number | undefined = config.PHOENIX_PORT;
      const grpcPort: number | undefined = config.PHOENIX_GRPC_PORT;
      const host: string | undefined = config.PHOENIX_HOST;
      const headers: Headers | undefined = config.PHOENIX_CLIENT_HEADERS;
      const endpoint: string | undefined = config.PHOENIX_COLLECTOR_ENDPOINT;
      const apiKey: string | undefined = config.PHOENIX_API_KEY;

      expect(port).toBe(6006);
      expect(grpcPort).toBeUndefined();
      expect(host).toBeUndefined();
      expect(headers).toEqual({ "X-Test": "value" });
      expect(endpoint).toBeUndefined();
      expect(apiKey).toBeUndefined();
    });
  });
});
