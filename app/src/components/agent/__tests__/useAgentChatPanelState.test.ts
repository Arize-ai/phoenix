import { describe, expect, it } from "vitest";

import { getDefaultInvocationConfig } from "@phoenix/pages/playground/providerAdapters";

import {
  selectAgentModel,
  toAgentModelSelection,
} from "../useAgentChatPanelState";

describe("toAgentModelSelection", () => {
  it.each(["OPENAI", "AZURE_OPENAI"] as const)(
    "defaults built-in %s models to the Responses API",
    (provider) => {
      expect(
        toAgentModelSelection({
          provider,
          modelName: "gpt-5.4",
          invocationParameters: getDefaultInvocationConfig(provider),
        })
      ).toEqual({
        providerType: "builtin",
        provider,
        modelName: "gpt-5.4",
        openaiApiType: "responses",
      });
    }
  );

  it("preserves a configured Chat Completions API type", () => {
    expect(
      toAgentModelSelection({
        provider: "OPENAI",
        modelName: "gpt-5.4",
        openaiApiType: "CHAT_COMPLETIONS",
        invocationParameters: getDefaultInvocationConfig("OPENAI"),
      })
    ).toEqual({
      providerType: "builtin",
      provider: "OPENAI",
      modelName: "gpt-5.4",
      openaiApiType: "chat_completions",
    });
  });

  it("does not set an OpenAI API type for other built-in providers", () => {
    expect(
      toAgentModelSelection({
        provider: "ANTHROPIC",
        modelName: "claude-opus-4-6",
        invocationParameters: getDefaultInvocationConfig("ANTHROPIC"),
      })
    ).toEqual({
      providerType: "builtin",
      provider: "ANTHROPIC",
      modelName: "claude-opus-4-6",
    });
  });

  it("omits the API type for custom provider selections", () => {
    expect(
      toAgentModelSelection({
        provider: "OPENAI",
        modelName: "custom-model",
        customProvider: { id: "provider-id", name: "Custom OpenAI" },
        invocationParameters: getDefaultInvocationConfig("OPENAI"),
      })
    ).toEqual({
      providerType: "custom",
      providerId: "provider-id",
      modelName: "custom-model",
    });
  });
});

describe("selectAgentModel", () => {
  it("derives a built-in selection from the store's default model config", () => {
    expect(
      selectAgentModel({
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
      selectAgentModel({
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

  it("prefers a persisted session model over the new-session default", () => {
    expect(
      selectAgentModel(
        {
          defaultModelConfig: {
            provider: "ANTHROPIC",
            modelName: "claude-opus-4-6",
            invocationParameters: getDefaultInvocationConfig("ANTHROPIC"),
          },
          modelConfigBySessionId: {
            "session-1": {
              provider: "OPENAI",
              modelName: "gpt-5.5",
              openaiApiType: "CHAT_COMPLETIONS",
              invocationParameters: getDefaultInvocationConfig("OPENAI"),
            },
          },
        },
        "session-1"
      )
    ).toEqual({
      providerType: "builtin",
      provider: "OPENAI",
      modelName: "gpt-5.5",
      openaiApiType: "chat_completions",
    });
  });
});
