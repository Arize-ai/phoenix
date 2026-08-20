import { describe, expect, it } from "vitest";

import type { AgentModelSelection } from "@phoenix/agent/chat/buildAgentChatRequestBody";
import { getDefaultInvocationConfig } from "@phoenix/pages/playground/providerAdapters";

import {
  resolvePersistedAgentModel,
  shouldNotifyModelChangedElsewhere,
  toAgentModelSelection,
} from "../agentSessionModel";

describe("resolvePersistedAgentModel", () => {
  it("restores a built-in selection", () => {
    expect(
      resolvePersistedAgentModel({
        model: {
          __typename: "AgentBuiltinProviderModelSelection",
          provider: "OPENAI",
          modelName: "gpt-5.5",
        },
        customProviders: [],
      })
    ).toMatchObject({
      provider: "OPENAI",
      modelName: "gpt-5.5",
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
        },
        customProviders: [],
      })
    ).toMatchObject({
      provider: "OPENAI",
      modelName: "free-typed-model",
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

describe("toAgentModelSelection", () => {
  it.each(["OPENAI", "AZURE_OPENAI", "ANTHROPIC"] as const)(
    "builds a built-in %s selection from provider and model name",
    (provider) => {
      expect(
        toAgentModelSelection({
          provider,
          modelName: "some-model",
          invocationParameters: getDefaultInvocationConfig(provider),
        })
      ).toEqual({
        providerType: "builtin",
        provider,
        modelName: "some-model",
      });
    }
  );

  it("ignores a configured OpenAI API type", () => {
    // The playground's ModelConfig can carry an API type, but the agent wire
    // selection no longer exposes one — the server always uses its default.
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

describe("shouldNotifyModelChangedElsewhere", () => {
  const selection = (modelName: string): AgentModelSelection => ({
    providerType: "builtin",
    provider: "OPENAI",
    modelName,
  });

  it("notifies when another client moved the session's model", () => {
    // This client asserted the model it was rendering; the server holds a
    // different one and no local change is in flight.
    expect(
      shouldNotifyModelChangedElsewhere({
        assertedModel: selection("mine"),
        refetchedModel: selection("theirs"),
        currentModel: selection("theirs"),
      })
    ).toBe(true);
  });

  it("skips the notice when this client's own change already landed", () => {
    // A send raced the client's own model change; by the time the refetch
    // returned, the change had landed, so the server now matches the assert.
    expect(
      shouldNotifyModelChangedElsewhere({
        assertedModel: selection("picked"),
        refetchedModel: selection("picked"),
        currentModel: selection("picked"),
      })
    ).toBe(false);
  });

  it("skips the notice while this client's own change is still in flight", () => {
    // The optimistic overlay makes the current read differ from the
    // refetched base record — the signature of an own change in flight.
    expect(
      shouldNotifyModelChangedElsewhere({
        assertedModel: selection("picked"),
        refetchedModel: selection("old"),
        currentModel: selection("picked"),
      })
    ).toBe(false);
  });

  it("skips the notice when the refetch returned no model", () => {
    expect(
      shouldNotifyModelChangedElsewhere({
        assertedModel: selection("mine"),
        refetchedModel: null,
        currentModel: selection("mine"),
      })
    ).toBe(false);
  });
});
