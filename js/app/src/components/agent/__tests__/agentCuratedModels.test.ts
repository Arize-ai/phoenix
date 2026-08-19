import { describe, expect, it } from "vitest";

import type { ModelMenuValue } from "@phoenix/components/generative/ModelMenu";

import {
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
        { providerKey: "ANTHROPIC", name: "claude-sonnet-4-6" },
      ])
    ).toEqual([
      { provider: "ANTHROPIC", modelName: "claude-sonnet-4-6" },
      { provider: "OPENAI", modelName: "gpt-5.6-sol" },
    ]);
  });

  it("keeps superseded models out of the recommended section", () => {
    // A model the server still offers stays selectable under "Other models",
    // but must not resurface as a recommendation once a newer tier lands.
    expect(
      isAgentCuratedModelSelection({
        provider: "GOOGLE",
        modelName: "gemini-3.5-flash",
      })
    ).toBe(false);
    expect(
      getCuratedBuiltInModels([
        { providerKey: "GOOGLE", name: "gemini-3.7-flash" },
        { providerKey: "GOOGLE", name: "gemini-3.5-flash" },
      ])
    ).toEqual([{ provider: "GOOGLE", modelName: "gemini-3.7-flash" }]);
  });
});
