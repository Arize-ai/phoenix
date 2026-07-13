import { describe, expect, it } from "vitest";

import { ExitCode, getExitCodeForError } from "../src/exitCodes";
import {
  createPxiProgram,
  resolveModelSelection,
  resolvePxiRuntimeOptions,
} from "../src/pxi/options";

describe("PXI options", () => {
  it("exposes pxi-specific help", () => {
    const help = createPxiProgram().helpInformation();

    expect(help).toContain("Usage: pxi");
    expect(help).toContain("--enable-web-access");
    expect(help).toContain("--custom-provider-id");
    expect(help).toContain("--skip-model-preflight");
  });

  it("defaults to the browser PXI model", () => {
    const selection = resolveModelSelection({});

    expect(selection).toEqual({
      providerType: "builtin",
      provider: "ANTHROPIC",
      modelName: "claude-opus-4-8",
    });
  });

  it("accepts built-in providers case-insensitively", () => {
    const selection = resolveModelSelection({
      provider: "anthropic",
      model: "claude-opus-4-6",
    });

    expect(selection).toEqual({
      providerType: "builtin",
      provider: "ANTHROPIC",
      modelName: "claude-opus-4-6",
    });
  });

  it("accepts MiniMax as a built-in provider", () => {
    const selection = resolveModelSelection({
      provider: "minimax",
      model: "MiniMax-M3",
    });

    expect(selection).toEqual({
      providerType: "builtin",
      provider: "MINIMAX",
      modelName: "MiniMax-M3",
    });
  });

  it("rejects invalid providers with an actionable error", () => {
    expect(() => resolveModelSelection({ provider: "BAD" })).toThrow(
      "Invalid value for --provider: BAD. Expected one of:"
    );
    try {
      resolveModelSelection({ provider: "BAD" });
    } catch (error) {
      expect(getExitCodeForError(error)).toBe(ExitCode.INVALID_ARGUMENT);
    }
  });

  it("requires --model for custom providers", () => {
    expect(() =>
      resolveModelSelection({ customProviderId: "provider-1" })
    ).toThrow(
      "Missing required flag --model when --custom-provider-id is provided"
    );
  });

  it("does not require a project", () => {
    const options = resolvePxiRuntimeOptions({
      cliOptions: { endpoint: "http://localhost:6006" },
      sessionId: "session-1",
    });

    expect(options.config.project).toBeUndefined();
    expect(options.sessionId).toBe("session-1");
  });

  it("defaults model preflight to enabled", () => {
    const options = resolvePxiRuntimeOptions({
      cliOptions: { endpoint: "http://localhost:6006" },
      sessionId: "session-1",
    });

    expect(options.skipModelPreflight).toBe(false);
  });

  it("supports skipping model preflight", () => {
    const options = resolvePxiRuntimeOptions({
      cliOptions: {
        endpoint: "http://localhost:6006",
        skipModelPreflight: true,
      },
      sessionId: "session-1",
    });

    expect(options.skipModelPreflight).toBe(true);
  });
});
