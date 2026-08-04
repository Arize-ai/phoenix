import { describe, expect, it } from "vitest";

import { resolvePersistedAgentModel } from "../agentSessionModel";

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
