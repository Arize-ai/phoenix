import { afterEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_PHOENIX_ENDPOINT, resolveConfig } from "../src/config";

describe("resolveConfig", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("uses CLI options over environment-derived defaults", () => {
    vi.stubEnv("PHOENIX_HOST", "https://env.example.com");
    vi.stubEnv("PHOENIX_API_KEY", "env-key");
    vi.stubEnv("PHOENIX_PROJECT", "env-project");

    const config = resolveConfig({
      cliOptions: {
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
      cliOptions: {},
    });

    expect(config.baseUrl).toBe(DEFAULT_PHOENIX_ENDPOINT);
  });
});
