import { describe, expect, it } from "vitest";

import type { ModelMenuValue } from "@phoenix/components/generative/ModelMenu";

import {
  AGENT_CURATED_BUILT_IN_MODELS,
  getAgentCuratedModelDisplayName,
  getAgentModelLabel,
  getCuratedBuiltInModels,
  isAgentCuratedModelSelection,
} from "../agentCuratedModels";

describe("agent curated models", () => {
  it("detects curated built-in models", () => {
    expect(
      isAgentCuratedModelSelection({
        provider: "OPENAI",
        modelName: "gpt-6-sol",
      })
    ).toBe(true);
  });

  it("treats built-in models outside the recommended list as untested", () => {
    expect(
      isAgentCuratedModelSelection({
        provider: "OPENAI",
        modelName: "gpt-4o",
      })
    ).toBe(false);
  });

  it("treats custom provider models as untested", () => {
    const customModel: ModelMenuValue = {
      provider: "OPENAI",
      modelName: "custom-agent-model",
      customProvider: {
        id: "custom-provider-id",
        name: "Custom Provider",
      },
    };

    expect(isAgentCuratedModelSelection(customModel)).toBe(false);
  });

  it("filters curated models against registered playground models", () => {
    expect(
      getCuratedBuiltInModels([
        { providerKey: "OPENAI", name: "gpt-6-sol" },
        { providerKey: "OPENAI", name: "gpt-4o" },
        { providerKey: "ANTHROPIC", name: "claude-sonnet-5-5" },
      ])
    ).toEqual([
      { provider: "ANTHROPIC", modelName: "claude-sonnet-5-5" },
      { provider: "OPENAI", modelName: "gpt-6-sol" },
    ]);
  });
});

describe("agent curated model display names", () => {
  it("gives every curated model a display name", () => {
    for (const curatedModel of AGENT_CURATED_BUILT_IN_MODELS) {
      expect(curatedModel.displayName.trim()).not.toBe("");
    }
  });

  it("returns the display name of curated models", () => {
    expect(
      getAgentCuratedModelDisplayName({
        provider: "ANTHROPIC",
        modelName: "claude-opus-5-5",
      })
    ).toBe("Claude Opus 5.5");
    expect(
      getAgentCuratedModelDisplayName({
        provider: "ANTHROPIC",
        modelName: "claude-sonnet-5-5",
      })
    ).toBe("Claude Sonnet 5.5");
    expect(
      getAgentCuratedModelDisplayName({
        provider: "ANTHROPIC",
        modelName: "claude-fable-5-1",
      })
    ).toBe("Claude Fable 5.1");
  });

  it("has no display name for other or custom provider models", () => {
    expect(
      getAgentCuratedModelDisplayName({
        provider: "OPENAI",
        modelName: "gpt-4o",
      })
    ).toBeNull();
    expect(
      getAgentCuratedModelDisplayName({
        provider: "ANTHROPIC",
        modelName: "claude-opus-4-6",
        customProvider: { id: "custom", name: "Custom" },
      })
    ).toBeNull();
    // Same id under another provider isn't curated
    expect(
      getAgentCuratedModelDisplayName({
        provider: "AWS",
        modelName: "claude-opus-4-6",
      })
    ).toBeNull();
  });

  it("labels models by display name, falling back to the id", () => {
    expect(
      getAgentModelLabel({ provider: "OPENAI", modelName: "gpt-6-sol" })
    ).toBe("GPT-6 Sol");
    expect(
      getAgentModelLabel({ provider: "OPENAI", modelName: "gpt-4o" })
    ).toBe("gpt-4o");
  });
});
