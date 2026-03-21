import { afterEach, describe, expect, it, vi } from "vitest";

import {
  DEFAULT_PHOENIX_ENDPOINT,
  loadConfigFromEnvironment,
  resolveConfig,
} from "../src/config";

describe("resolveConfig", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
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

  it("loads headers from the shared phoenix config helpers", () => {
    vi.stubEnv("PHOENIX_CLIENT_HEADERS", '{"X-Test":"value"}');

    const config = loadConfigFromEnvironment();

    expect(config.headers).toEqual({
      "X-Test": "value",
    });
  });
});
