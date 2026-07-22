import { describe, expect, it } from "vitest";

import { getDefaultInvocationConfig } from "@phoenix/pages/playground/providerAdapters";

import {
  buildAgentModelSelection,
  selectAgentModelSelection,
} from "../useAgentChatPanelState";

describe("buildAgentModelSelection", () => {
  it.each(["OPENAI", "AZURE_OPENAI"] as const)(
    "uses the Responses API for built-in %s models",
    (provider) => {
      expect(
        buildAgentModelSelection({
          model: { provider, modelName: "gpt-5.4" },
        })
      ).toEqual({
        providerType: "builtin",
        provider,
        modelName: "gpt-5.4",
        openaiApiType: "responses",
      });
    }
  );

  it("does not set an OpenAI API type for other built-in providers", () => {
    expect(
      buildAgentModelSelection({
        model: { provider: "ANTHROPIC", modelName: "claude-opus-4-6" },
      })
    ).toEqual({
      providerType: "builtin",
      provider: "ANTHROPIC",
      modelName: "claude-opus-4-6",
    });
  });

  it("omits the API type for custom provider selections", () => {
    expect(
      buildAgentModelSelection({
        model: {
          provider: "OPENAI",
          modelName: "custom-model",
          customProvider: { id: "provider-id", name: "Custom OpenAI" },
        },
      })
    ).toEqual({
      providerType: "custom",
      providerId: "provider-id",
      modelName: "custom-model",
    });
  });
});

describe("selectAgentModelSelection", () => {
  it("derives a built-in selection from the store's default model config", () => {
    expect(
      selectAgentModelSelection({
        defaultModelConfig: {
          provider: "OPENAI",
          modelName: "gpt-5.5",
          invocationParameters: getDefaultInvocationConfig("OPENAI"),
        },
      })
    ).toEqual({
      providerType: "builtin",
      provider: "OPENAI",
      modelName: "gpt-5.5",
      openaiApiType: "responses",
    });
  });

  it("derives a custom selection when the config names a custom provider", () => {
    expect(
      selectAgentModelSelection({
        defaultModelConfig: {
          provider: "OPENAI",
          modelName: "custom-model",
          customProvider: { id: "provider-id", name: "Custom OpenAI" },
          invocationParameters: getDefaultInvocationConfig("OPENAI"),
        },
      })
    ).toEqual({
      providerType: "custom",
      providerId: "provider-id",
      modelName: "custom-model",
    });
  });
});
