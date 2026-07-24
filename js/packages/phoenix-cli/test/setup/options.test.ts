import { describe, expect, it } from "vitest";

import { HeadlessInputError } from "../../src/setup/errors";
import { resolveSetupInputs, type SetupOptions } from "../../src/setup/options";
import { fakeRunContext } from "./fakes";

/** Resolve against a fake context; defaults mirror an interactive terminal. */
function resolve(
  options: SetupOptions = {},
  context: {
    env?: Record<string, string | undefined>;
    stdinIsTTY?: boolean;
  } = {}
) {
  return resolveSetupInputs({ options, context: fakeRunContext(context) });
}

describe("resolveSetupInputs", () => {
  it("prefers flags over env vars", () => {
    const inputs = resolve(
      { endpoint: "http://flag:6006", project: "flag-project" },
      {
        env: {
          PHOENIX_HOST: "http://env:6006",
          PHOENIX_PROJECT: "env-project",
        },
      }
    );
    expect(inputs.endpoint).toBe("http://flag:6006");
    expect(inputs.project).toBe("flag-project");
  });

  it("accepts PHOENIX_COLLECTOR_ENDPOINT and PHOENIX_PROJECT_NAME as aliases", () => {
    const inputs = resolve(
      {},
      {
        env: {
          PHOENIX_COLLECTOR_ENDPOINT: "http://collector:6006",
          PHOENIX_PROJECT_NAME: "named-project",
        },
      }
    );
    expect(inputs.endpoint).toBe("http://collector:6006");
    expect(inputs.project).toBe("named-project");
  });

  it("prefers the canonical px env vars over the aliases", () => {
    const inputs = resolve(
      {},
      {
        env: {
          PHOENIX_HOST: "http://host:6006",
          PHOENIX_COLLECTOR_ENDPOINT: "http://collector:6006",
          PHOENIX_PROJECT: "px-project",
          PHOENIX_PROJECT_NAME: "sdk-project",
        },
      }
    );
    expect(inputs.endpoint).toBe("http://host:6006");
    expect(inputs.project).toBe("px-project");
  });

  it("reads the API key from env only", () => {
    const inputs = resolve({}, { env: { PHOENIX_API_KEY: "sk-test" } });
    expect(inputs.apiKey).toBe("sk-test");
  });

  it("is headless when --no-input is passed", () => {
    const inputs = resolve({ noInput: true });
    expect(inputs.headless).toBe(true);
  });

  it("is headless when stdin is not a TTY", () => {
    const inputs = resolve({}, { stdinIsTTY: false });
    expect(inputs.headless).toBe(true);
  });

  it("env vars alone do not trigger headless mode", () => {
    const inputs = resolve({}, { env: { PHOENIX_API_KEY: "ambient" } });
    expect(inputs.headless).toBe(false);
  });

  it("instruments by default when interactive", () => {
    const inputs = resolve();
    expect(inputs.instrument).toBe(true);
  });

  it("does not instrument by default when headless", () => {
    const inputs = resolve({ noInput: true });
    expect(inputs.instrument).toBe(false);
  });

  it("--no-instrument wins over the interactive default", () => {
    const inputs = resolve({ instrument: false });
    expect(inputs.instrument).toBe(false);
  });

  it("backgrounds the agent by default only when headless", () => {
    expect(resolve().background).toBe(false);
    expect(resolve({ noInput: true }).background).toBe(true);
  });

  it("--background is honored in an interactive run", () => {
    const inputs = resolve({ background: true });
    expect(inputs.background).toBe(true);
    expect(inputs.headless).toBe(false);
  });

  it("headless instrumentation without --agent names the flag and the ids", () => {
    expect(() => resolve({ noInput: true, instrument: true })).toThrow(
      HeadlessInputError
    );
    try {
      resolve({ noInput: true, instrument: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      expect(message).toContain("--agent");
      expect(message).toContain("claude|codex|opencode|cursor");
    }
  });

  it("headless instrumentation resolves once --agent names a lane", () => {
    const inputs = resolve({
      noInput: true,
      instrument: true,
      agent: "codex",
      bypassPermissions: true,
      languages: ["python"],
    });
    expect(inputs).toMatchObject({
      headless: true,
      instrument: true,
      agent: "codex",
      background: true,
      bypassPermissions: true,
      languages: ["python"],
    });
  });

  it("a headless registration-only run needs no agent", () => {
    const inputs = resolve({ noInput: true });
    expect(inputs.agent).toBeUndefined();
    expect(inputs.instrument).toBe(false);
  });

  it("defaults languages, bypassPermissions and the docs prefetch", () => {
    const inputs = resolve();
    expect(inputs.languages).toEqual([]);
    expect(inputs.bypassPermissions).toBe(false);
    expect(inputs.skills).toBeUndefined();
    expect(inputs.docs).toEqual({ enabled: true });
  });

  it("passes the docs prefetch options through", () => {
    const inputs = resolve({ docs: { enabled: false } });
    expect(inputs.docs).toEqual({ enabled: false });
  });
});
