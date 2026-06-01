import {
  createListPlaygroundModelTargetsClientAction,
  createSetPlaygroundModelClientAction,
  parseListPlaygroundModelTargetsInput,
  parseSetPlaygroundModelInput,
} from "@phoenix/agent/tools/playgroundModel";
import {
  _resetInstanceId,
  _resetMessageId,
  createPlaygroundStore,
} from "@phoenix/store/playground";

const installedBuiltInProviders = new Set<ModelProvider>([
  "OPENAI",
  "ANTHROPIC",
]);

describe("playground model agent tools", () => {
  beforeEach(() => {
    localStorage.removeItem("arize-phoenix-agent");
    _resetInstanceId();
    _resetMessageId();
  });

  it("parses set_playground_model input and common aliases", () => {
    expect(
      parseSetPlaygroundModelInput({
        instance_id: 1,
        target: {
          type: "custom",
          custom_provider_id: "custom-provider-id",
          model_name: "custom-model",
        },
      })
    ).toEqual({
      instanceId: 1,
      target: {
        type: "custom",
        customProviderId: "custom-provider-id",
        modelName: "custom-model",
      },
    });
  });

  it("parses list_playground_model_targets empty input", () => {
    expect(parseListPlaygroundModelTargetsInput(undefined)).toEqual({});
    expect(parseListPlaygroundModelTargetsInput({})).toEqual({});
    expect(parseListPlaygroundModelTargetsInput({ unexpected: true })).toBe(
      null
    );
  });

  it("lists available built-in and custom playground model targets", async () => {
    const action = createListPlaygroundModelTargetsClientAction({
      availableBuiltinModels: [
        { provider: "OPENAI", modelName: "gpt-5" },
        { provider: "ANTHROPIC", modelName: "claude-sonnet-4-6" },
      ],
      availableCustomModels: [
        {
          customProviderId: "custom-provider-id",
          customProviderName: "Custom OpenAI",
          provider: "OPENAI",
          modelName: "custom-model",
        },
      ],
    });

    const result = await action({});

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error(result.error);
    }
    const output = JSON.parse(result.output ?? "{}");
    expect(output).toEqual({
      builtinModels: [
        {
          target: { type: "builtin", provider: "OPENAI", modelName: "gpt-5" },
        },
        {
          target: {
            type: "builtin",
            provider: "ANTHROPIC",
            modelName: "claude-sonnet-4-6",
          },
        },
      ],
      customProviderModels: [
        {
          target: {
            type: "custom",
            customProviderId: "custom-provider-id",
            modelName: "custom-model",
          },
          customProviderName: "Custom OpenAI",
          provider: "OPENAI",
        },
      ],
      message:
        "Use the returned target payloads when calling set_playground_model.",
    });
  });

  it("lists empty playground model targets", async () => {
    const action = createListPlaygroundModelTargetsClientAction({
      availableBuiltinModels: [],
      availableCustomModels: [],
    });

    const result = await action({});

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error(result.error);
    }
    expect(JSON.parse(result.output ?? "{}")).toMatchObject({
      builtinModels: [],
      customProviderModels: [],
    });
  });

  it("switches the only playground instance when instanceId is omitted", async () => {
    const playgroundStore = createPlaygroundStore({
      datasetId: null,
      modelConfigByProvider: {},
    });
    const action = createSetPlaygroundModelClientAction({
      playgroundStore,
      modelCatalog: { installedBuiltInProviders, customProviders: [] },
      modelConfigByProvider: {},
    });

    const result = await action({
      target: { type: "builtin", provider: "OPENAI", modelName: "gpt-5" },
    });

    expect(result.ok).toBe(true);
    expect(playgroundStore.getState().instances[0]?.model).toMatchObject({
      provider: "OPENAI",
      modelName: "gpt-5",
      customProvider: null,
    });
  });

  it("requires instanceId when multiple playground instances are available", async () => {
    const playgroundStore = createPlaygroundStore({
      datasetId: null,
      modelConfigByProvider: {},
    });
    playgroundStore.getState().addInstance();
    const action = createSetPlaygroundModelClientAction({
      playgroundStore,
      modelCatalog: { installedBuiltInProviders, customProviders: [] },
      modelConfigByProvider: {},
    });

    const result = await action({
      target: { type: "builtin", provider: "OPENAI", modelName: "gpt-5" },
    });

    expect(result).toEqual(
      expect.objectContaining({
        ok: false,
        error: expect.stringContaining("Multiple playground instances"),
      })
    );
  });

  it("switches a specific instance to a built-in provider and model", async () => {
    const playgroundStore = createPlaygroundStore({
      datasetId: null,
      modelConfigByProvider: {},
    });
    playgroundStore.getState().addInstance();
    const action = createSetPlaygroundModelClientAction({
      playgroundStore,
      modelCatalog: { installedBuiltInProviders, customProviders: [] },
      modelConfigByProvider: {},
    });

    const result = await action({
      instanceId: 1,
      target: {
        type: "builtin",
        provider: "ANTHROPIC",
        modelName: "claude-sonnet-4-6",
      },
    });

    expect(result.ok).toBe(true);
    const instance = playgroundStore
      .getState()
      .instances.find((candidate) => candidate.id === 1);
    expect(instance?.model).toMatchObject({
      provider: "ANTHROPIC",
      modelName: "claude-sonnet-4-6",
      customProvider: null,
    });
  });

  it("switches to a configured custom provider model", async () => {
    const playgroundStore = createPlaygroundStore({
      datasetId: null,
      modelConfigByProvider: {},
    });
    const action = createSetPlaygroundModelClientAction({
      playgroundStore,
      modelCatalog: {
        installedBuiltInProviders,
        customProviders: [
          {
            id: "custom-provider-id",
            name: "Custom OpenAI",
            sdk: "OPENAI",
            modelNames: ["custom-model"],
          },
        ],
      },
      modelConfigByProvider: {},
    });

    const result = await action({
      target: {
        type: "custom",
        customProviderId: "custom-provider-id",
        modelName: "custom-model",
      },
    });

    expect(result.ok).toBe(true);
    expect(playgroundStore.getState().instances[0]?.model).toMatchObject({
      provider: "OPENAI",
      modelName: "custom-model",
      customProvider: {
        id: "custom-provider-id",
        name: "Custom OpenAI",
      },
    });
  });

  it("rejects unavailable built-in providers and missing custom providers", async () => {
    const playgroundStore = createPlaygroundStore({
      datasetId: null,
      modelConfigByProvider: {},
    });
    const action = createSetPlaygroundModelClientAction({
      playgroundStore,
      modelCatalog: { installedBuiltInProviders, customProviders: [] },
      modelConfigByProvider: {},
    });

    await expect(
      action({
        target: {
          type: "builtin",
          provider: "GOOGLE",
          modelName: "gemini-2.5-pro",
        },
      })
    ).resolves.toEqual(
      expect.objectContaining({
        ok: false,
        error: expect.stringContaining("not available"),
      })
    );
    await expect(
      action({
        target: {
          type: "custom",
          customProviderId: "missing-provider",
          modelName: "custom-model",
        },
      })
    ).resolves.toEqual(
      expect.objectContaining({
        ok: false,
        error: expect.stringContaining("was not found"),
      })
    );
  });
});
