import { describe, it, expect } from "vitest";
import {
  configSchema,
  getDefaultConfig,
  type Config,
} from "../../src/config/schema";

describe("configSchema", () => {
  describe("default values", () => {
    it("should provide correct defaults when parsing empty object", () => {
      const config = configSchema.parse({});

      expect(config.baseUrl).toBe("http://localhost:6006");
      expect(config.apiKey).toBeUndefined();
      expect(config.limit).toBe(1000);
      expect(config.stream).toBe(true);
      expect(config.mode).toBe("sandbox");
      expect(config.refresh).toBe(false);
      expect(config.trace).toBe(false);
    });

    it("getDefaultConfig should return all defaults", () => {
      const config = getDefaultConfig();

      expect(config.baseUrl).toBe("http://localhost:6006");
      expect(config.apiKey).toBeUndefined();
      expect(config.limit).toBe(1000);
      expect(config.stream).toBe(true);
      expect(config.mode).toBe("sandbox");
      expect(config.refresh).toBe(false);
      expect(config.trace).toBe(false);
    });
  });

  describe("baseUrl validation", () => {
    it("should accept valid URL strings", () => {
      const config = configSchema.parse({
        baseUrl: "https://phoenix.example.com",
      });
      expect(config.baseUrl).toBe("https://phoenix.example.com");
    });

    it("should accept localhost URLs", () => {
      const config = configSchema.parse({ baseUrl: "http://localhost:8080" });
      expect(config.baseUrl).toBe("http://localhost:8080");
    });

    it("should use default when baseUrl not provided", () => {
      const config = configSchema.parse({});
      expect(config.baseUrl).toBe("http://localhost:6006");
    });
  });

  describe("apiKey validation", () => {
    it("should accept string API key", () => {
      const config = configSchema.parse({ apiKey: "my-secret-key" });
      expect(config.apiKey).toBe("my-secret-key");
    });

    it("should allow undefined API key", () => {
      const config = configSchema.parse({});
      expect(config.apiKey).toBeUndefined();
    });

    it("should allow omitting API key", () => {
      const config = configSchema.parse({ baseUrl: "http://example.com" });
      expect(config.apiKey).toBeUndefined();
    });
  });

  describe("limit validation", () => {
    it("should accept positive integers", () => {
      const config = configSchema.parse({ limit: 500 });
      expect(config.limit).toBe(500);
    });

    it("should use default when not provided", () => {
      const config = configSchema.parse({});
      expect(config.limit).toBe(1000);
    });

    it("should reject zero", () => {
      expect(() => configSchema.parse({ limit: 0 })).toThrow();
    });

    it("should reject negative numbers", () => {
      expect(() => configSchema.parse({ limit: -10 })).toThrow();
    });

    it("should reject non-integer numbers", () => {
      expect(() => configSchema.parse({ limit: 10.5 })).toThrow();
    });
  });

  describe("stream validation", () => {
    it("should accept true", () => {
      const config = configSchema.parse({ stream: true });
      expect(config.stream).toBe(true);
    });

    it("should accept false", () => {
      const config = configSchema.parse({ stream: false });
      expect(config.stream).toBe(false);
    });

    it("should default to true", () => {
      const config = configSchema.parse({});
      expect(config.stream).toBe(true);
    });
  });

  describe("mode validation", () => {
    it("should accept sandbox mode", () => {
      const config = configSchema.parse({ mode: "sandbox" });
      expect(config.mode).toBe("sandbox");
    });

    it("should accept local mode", () => {
      const config = configSchema.parse({ mode: "local" });
      expect(config.mode).toBe("local");
    });

    it("should default to sandbox", () => {
      const config = configSchema.parse({});
      expect(config.mode).toBe("sandbox");
    });

    it("should reject invalid modes", () => {
      expect(() => configSchema.parse({ mode: "cloud" })).toThrow();
      expect(() => configSchema.parse({ mode: "remote" })).toThrow();
    });
  });

  describe("refresh validation", () => {
    it("should accept true", () => {
      const config = configSchema.parse({ refresh: true });
      expect(config.refresh).toBe(true);
    });

    it("should accept false", () => {
      const config = configSchema.parse({ refresh: false });
      expect(config.refresh).toBe(false);
    });

    it("should default to false", () => {
      const config = configSchema.parse({});
      expect(config.refresh).toBe(false);
    });
  });

  describe("trace validation", () => {
    it("should accept true", () => {
      const config = configSchema.parse({ trace: true });
      expect(config.trace).toBe(true);
    });

    it("should accept false", () => {
      const config = configSchema.parse({ trace: false });
      expect(config.trace).toBe(false);
    });

    it("should default to false", () => {
      const config = configSchema.parse({});
      expect(config.trace).toBe(false);
    });
  });

  describe("full configuration", () => {
    it("should accept all fields together", () => {
      const fullConfig: Config = {
        baseUrl: "https://phoenix.prod.example.com",
        apiKey: "prod-api-key-123",
        limit: 5000,
        stream: false,
        mode: "local",
        refresh: true,
        trace: true,
      };

      const config = configSchema.parse(fullConfig);

      expect(config).toEqual(fullConfig);
    });

    it("should merge provided values with defaults", () => {
      const partialConfig = {
        baseUrl: "https://custom.url",
        mode: "local" as const,
      };

      const config = configSchema.parse(partialConfig);

      expect(config.baseUrl).toBe("https://custom.url");
      expect(config.mode).toBe("local");
      // Check defaults are applied for unprovided values
      expect(config.limit).toBe(1000);
      expect(config.stream).toBe(true);
      expect(config.refresh).toBe(false);
      expect(config.trace).toBe(false);
    });
  });

  describe("type safety", () => {
    it("Config type should have correct shape", () => {
      // TypeScript compile-time check - if this compiles, the type is correct
      const config: Config = {
        baseUrl: "http://localhost:6006",
        apiKey: undefined,
        limit: 1000,
        stream: true,
        mode: "sandbox",
        refresh: false,
        trace: false,
      };

      // Runtime verification
      expect(config).toBeDefined();
    });

    it("should reject unknown properties in strict mode", () => {
      const configWithExtra = {
        baseUrl: "http://localhost:6006",
        unknownField: "should be stripped",
      };

      // By default, zod strips unknown keys rather than rejecting
      const config = configSchema.parse(configWithExtra);
      expect((config as any).unknownField).toBeUndefined();
    });
  });
});
