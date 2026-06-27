import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ExitCode, getExitCodeForError } from "../src/exitCodes";
import {
  createPxiProgram,
  formatModelSelection,
  parseModelString,
  parsePxiRuntimeOptions,
  resolveModelSelection,
  resolvePxiRuntimeOptions,
} from "../src/pxi/options";

describe("parseModelString", () => {
  it("splits provider/model combined string", () => {
    expect(parseModelString("openai/gpt-5.5")).toEqual({
      provider: "openai",
      model: "gpt-5.5",
    });
  });

  it("returns undefined provider for bare model name", () => {
    expect(parseModelString("gpt-5.5")).toEqual({
      provider: undefined,
      model: "gpt-5.5",
    });
  });

  it("uses only the first slash as delimiter", () => {
    expect(parseModelString("openai/gpt/turbo")).toEqual({
      provider: "openai",
      model: "gpt/turbo",
    });
  });
});

describe("formatModelSelection", () => {
  it("formats a builtin selection as lowercase-provider/model", () => {
    expect(
      formatModelSelection({
        providerType: "builtin",
        provider: "OPENAI",
        modelName: "gpt-5.5",
      })
    ).toBe("openai/gpt-5.5");
  });

  it("formats a custom selection as providerId/model", () => {
    expect(
      formatModelSelection({
        providerType: "custom",
        providerId: "my-provider",
        modelName: "my-model",
      })
    ).toBe("my-provider/my-model");
  });
});

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

  it("accepts provider/model combined string in --model flag", () => {
    const selection = resolveModelSelection({ model: "openai/gpt-5.5" });

    expect(selection).toEqual({
      providerType: "builtin",
      provider: "OPENAI",
      modelName: "gpt-5.5",
    });
  });

  it("provider/model combined string overrides explicit --provider flag", () => {
    const selection = resolveModelSelection({
      provider: "ANTHROPIC",
      model: "openai/gpt-5.5",
    });

    expect(selection).toEqual({
      providerType: "builtin",
      provider: "OPENAI",
      modelName: "gpt-5.5",
    });
  });

  it("ignores provider/model split for --model when --custom-provider-id is set", () => {
    const selection = resolveModelSelection({
      customProviderId: "my-provider",
      model: "some/model",
    });

    expect(selection).toEqual({
      providerType: "custom",
      providerId: "my-provider",
      modelName: "some/model",
    });
  });
});

describe("parsePxiRuntimeOptions model persistence", () => {
  let tmpDir: string;
  let settingsPath: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "phoenix-pxi-test-"));
    settingsPath = path.join(tmpDir, "settings.json");
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("saves the model to settings when --model is passed explicitly", async () => {
    await parsePxiRuntimeOptions({
      argv: [
        "node",
        "pxi",
        "--model",
        "openai/gpt-5.5",
        "--skip-model-preflight",
      ],
      settingsPath,
    });

    const saved = JSON.parse(fs.readFileSync(settingsPath, "utf-8"));
    expect(saved.pxi?.model).toBe("openai/gpt-5.5");
  });

  it("saves the model to settings when --provider and --model are passed", async () => {
    await parsePxiRuntimeOptions({
      argv: [
        "node",
        "pxi",
        "--provider",
        "OPENAI",
        "--model",
        "gpt-5.5",
        "--skip-model-preflight",
      ],
      settingsPath,
    });

    const saved = JSON.parse(fs.readFileSync(settingsPath, "utf-8"));
    expect(saved.pxi?.model).toBe("openai/gpt-5.5");
  });

  it("restores model from settings when no flags are passed", async () => {
    fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
    fs.writeFileSync(
      settingsPath,
      JSON.stringify({
        activeProfile: null,
        profiles: {},
        pxi: { model: "openai/gpt-5.5" },
      }),
      "utf-8"
    );

    const options = await parsePxiRuntimeOptions({
      argv: ["node", "pxi", "--skip-model-preflight"],
      settingsPath,
    });

    expect(options.modelSelection).toEqual({
      providerType: "builtin",
      provider: "OPENAI",
      modelName: "gpt-5.5",
    });
  });

  it("does not save to settings when no model flags are passed", async () => {
    await parsePxiRuntimeOptions({
      argv: ["node", "pxi", "--skip-model-preflight"],
      settingsPath,
    });

    expect(fs.existsSync(settingsPath)).toBe(false);
  });
});
