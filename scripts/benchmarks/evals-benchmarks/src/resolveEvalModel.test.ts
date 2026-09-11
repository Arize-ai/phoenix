import { describe, expect, it } from "vitest";

import { parseEvalModelRef } from "./resolveEvalModel.js";

describe("parseEvalModelRef", () => {
  it("defaults unknown prefixes to openai", () => {
    expect(parseEvalModelRef("gpt-4o-mini")).toEqual({
      provider: "openai",
      modelId: "gpt-4o-mini",
      raw: "gpt-4o-mini",
    });
    expect(parseEvalModelRef("o3-mini")).toEqual({
      provider: "openai",
      modelId: "o3-mini",
      raw: "o3-mini",
    });
  });

  it("maps claude* to anthropic and gemini*/gemma* to google", () => {
    expect(parseEvalModelRef("claude-sonnet-4-5")).toEqual({
      provider: "anthropic",
      modelId: "claude-sonnet-4-5",
      raw: "claude-sonnet-4-5",
    });
    expect(parseEvalModelRef("gemini-2.5-flash")).toEqual({
      provider: "google",
      modelId: "gemini-2.5-flash",
      raw: "gemini-2.5-flash",
    });
    expect(parseEvalModelRef("gemma-3-27b-it")).toEqual({
      provider: "google",
      modelId: "gemma-3-27b-it",
      raw: "gemma-3-27b-it",
    });
  });

  it("honors an explicit provider:model prefix", () => {
    expect(parseEvalModelRef("anthropic:claude-x")).toEqual({
      provider: "anthropic",
      modelId: "claude-x",
      raw: "anthropic:claude-x",
    });
    expect(parseEvalModelRef("openai:gpt-4o")).toEqual({
      provider: "openai",
      modelId: "gpt-4o",
      raw: "openai:gpt-4o",
    });
    expect(parseEvalModelRef("google:gemini-2.5-flash")).toEqual({
      provider: "google",
      modelId: "gemini-2.5-flash",
      raw: "google:gemini-2.5-flash",
    });
  });

  it("rejects an unknown provider prefix or a missing model id", () => {
    expect(() => parseEvalModelRef("foo:bar")).toThrow(
      /Unknown eval model provider/
    );
    expect(() => parseEvalModelRef("anthropic:")).toThrow(/missing a model id/);
    expect(() => parseEvalModelRef("   ")).toThrow(/non-empty/);
  });
});
