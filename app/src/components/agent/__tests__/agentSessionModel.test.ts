import { describe, expect, it, vi } from "vitest";

import { getDefaultInvocationConfig } from "@phoenix/pages/playground/providerAdapters";
import type { ModelConfig } from "@phoenix/store/playground/types";

import {
  applyServerSessionModelConfig,
  resolvePersistedAgentModel,
} from "../agentSessionModel";

describe("resolvePersistedAgentModel", () => {
  it("restores a built-in selection with its persisted API type", () => {
    expect(
      resolvePersistedAgentModel({
        model: {
          __typename: "AgentBuiltinProviderModelSelection",
          provider: "OPENAI",
          modelName: "gpt-5.5",
          openaiApiType: "CHAT_COMPLETIONS",
        },
        customProviders: [],
      })
    ).toMatchObject({
      provider: "OPENAI",
      modelName: "gpt-5.5",
      openaiApiType: "CHAT_COMPLETIONS",
    });
  });

  it("restores a custom selection with its current provider identity", () => {
    expect(
      resolvePersistedAgentModel({
        model: {
          __typename: "AgentCustomProviderModelSelection",
          providerId: "provider-1",
          modelName: "custom-model",
        },
        customProviders: [
          {
            id: "provider-1",
            name: "Custom OpenAI",
            sdk: "OPENAI",
            modelNames: ["custom-model"],
          },
        ],
      })
    ).toMatchObject({
      provider: "OPENAI",
      modelName: "custom-model",
      customProvider: {
        id: "provider-1",
        name: "Custom OpenAI",
      },
    });
  });

  it("mirrors a free-typed model name absent from the provider's catalog", () => {
    // The model menu allows typing names the provider does not advertise and
    // the server persists them without validation; substituting a different
    // model here would make every send assert a model the server does not
    // hold, rejecting each one as stale.
    expect(
      resolvePersistedAgentModel({
        model: {
          __typename: "AgentCustomProviderModelSelection",
          providerId: "provider-1",
          modelName: "user-supplied-model",
        },
        customProviders: [
          {
            id: "provider-1",
            name: "Custom OpenAI",
            sdk: "OPENAI",
            modelNames: ["advertised-model"],
          },
        ],
      })
    ).toMatchObject({
      modelName: "user-supplied-model",
      customProvider: { id: "provider-1", name: "Custom OpenAI" },
    });
  });

  it("mirrors a persisted built-in model even when it is not in the catalog", () => {
    expect(
      resolvePersistedAgentModel({
        model: {
          __typename: "AgentBuiltinProviderModelSelection",
          provider: "OPENAI",
          modelName: "free-typed-model",
          openaiApiType: "RESPONSES",
        },
        customProviders: [],
      })
    ).toMatchObject({
      provider: "OPENAI",
      modelName: "free-typed-model",
      openaiApiType: "RESPONSES",
    });
  });

  it("keeps the persisted identity when the custom provider was deleted", () => {
    expect(
      resolvePersistedAgentModel({
        model: {
          __typename: "AgentCustomProviderModelSelection",
          providerId: "provider-gone",
          modelName: "orphaned-model",
        },
        customProviders: [],
      })
    ).toMatchObject({
      modelName: "orphaned-model",
      customProvider: { id: "provider-gone" },
    });
  });
});

describe("applyServerSessionModelConfig", () => {
  const sessionModel = (modelName: string): ModelConfig => ({
    provider: "OPENAI",
    modelName,
    invocationParameters: getDefaultInvocationConfig("OPENAI"),
  });

  const createState = () => {
    const state = {
      isModelWritePendingBySessionId: {} as Partial<Record<string, boolean>>,
      modelConfigBySessionId: {} as Partial<Record<string, ModelConfig>>,
      setSessionModelConfig: vi.fn((sessionId: string, config: ModelConfig) => {
        state.modelConfigBySessionId = {
          ...state.modelConfigBySessionId,
          [sessionId]: config,
        };
      }),
    };
    return state;
  };

  it("applies a server-read model when no local write is pending", () => {
    const state = createState();

    applyServerSessionModelConfig({
      state,
      sessionId: "s1",
      config: sessionModel("a"),
    });

    expect(state.modelConfigBySessionId["s1"]).toEqual(sessionModel("a"));
  });

  it("ignores a server read that races an unacknowledged model change", () => {
    const state = createState();
    // The user picks a model; the write has not landed yet.
    state.modelConfigBySessionId = { s1: sessionModel("picked") };
    state.isModelWritePendingBySessionId = { s1: true };

    // A poll returns the pre-change model.
    applyServerSessionModelConfig({
      state,
      sessionId: "s1",
      config: sessionModel("old"),
    });
    expect(state.modelConfigBySessionId["s1"]).toEqual(sessionModel("picked"));

    // Once acknowledged, server reads take effect again.
    state.isModelWritePendingBySessionId = { s1: false };
    applyServerSessionModelConfig({
      state,
      sessionId: "s1",
      config: sessionModel("remote"),
    });
    expect(state.modelConfigBySessionId["s1"]).toEqual(sessionModel("remote"));
  });

  it("scopes the pending guard to one session", () => {
    const state = createState();
    state.isModelWritePendingBySessionId = { s1: true };

    applyServerSessionModelConfig({
      state,
      sessionId: "s2",
      config: sessionModel("b"),
    });

    expect(state.modelConfigBySessionId["s2"]).toEqual(sessionModel("b"));
  });

  it("skips the store write when the server model is structurally equal", () => {
    const state = createState();
    state.modelConfigBySessionId = { s1: sessionModel("a") };

    // Poll ticks re-apply the same model; an equal config must not replace
    // the map and re-render every session surface.
    applyServerSessionModelConfig({
      state,
      sessionId: "s1",
      config: sessionModel("a"),
    });

    expect(state.setSessionModelConfig).not.toHaveBeenCalled();
  });
});
