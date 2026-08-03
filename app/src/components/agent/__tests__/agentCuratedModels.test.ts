import { describe, expect, it } from "vitest";

import type { ModelMenuValue } from "@phoenix/components/generative/ModelMenu";

import {
  AGENT_CURATED_BUILT_IN_MODELS,
  AGENT_MODEL_TAG_INFO,
  getCuratedBuiltInModels,
  isAgentCuratedModelSelection,
} from "../agentCuratedModels";

describe("agent curated models", () => {
  it("detects curated built-in models", () => {
    expect(
      isAgentCuratedModelSelection({
        provider: "OPENAI",
        modelName: "gpt-5.6-sol",
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

  it("treats models culled from the recommended list as untested", () => {
    expect(
      isAgentCuratedModelSelection({
        provider: "ANTHROPIC",
        modelName: "claude-sonnet-4-6",
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
        { providerKey: "OPENAI", name: "gpt-5.6-sol" },
        { providerKey: "OPENAI", name: "gpt-4o" },
        { providerKey: "ANTHROPIC", name: "claude-sonnet-5" },
      ])
    ).toEqual([
      { provider: "ANTHROPIC", modelName: "claude-sonnet-5", tag: "fastest" },
      { provider: "OPENAI", modelName: "gpt-5.6-sol", tag: "advanced" },
    ]);
  });

  it("labels every curated model with a known tag", () => {
    for (const model of AGENT_CURATED_BUILT_IN_MODELS) {
      expect(AGENT_MODEL_TAG_INFO[model.tag]).toBeDefined();
      expect(AGENT_MODEL_TAG_INFO[model.tag].label).toBeTruthy();
      expect(AGENT_MODEL_TAG_INFO[model.tag].description).toBeTruthy();
    }
  });
});
