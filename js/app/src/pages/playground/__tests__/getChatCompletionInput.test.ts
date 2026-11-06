import { installTestStorage } from "@phoenix/__tests__/installTestStorage";
import { getChatCompletionInput } from "@phoenix/pages/playground/playgroundUtils";
import { createCredentialsStore, createPlaygroundStore } from "@phoenix/store";

installTestStorage();

describe("getChatCompletionInput", () => {
  it.each(["gpt-5.6-sol", "gpt-future"])(
    "uses the Responses API by default for OpenAI model %s",
    (modelName) => {
      const playgroundStore = createPlaygroundStore({
        datasetId: null,
        defaultModelName: modelName,
        defaultModelProvider: "OPENAI",
        modelConfigByProvider: {},
      });
      const credentials = createCredentialsStore({}).getState();
      const instanceId = playgroundStore.getState().instances[0].id;

      const input = getChatCompletionInput({
        playgroundStore,
        instanceId,
        credentials,
      });

      expect(input.connectionConfig?.openaiApiType).toBe("RESPONSES");
    }
  );

  it("preserves an explicit Chat Completions selection", () => {
    const playgroundStore = createPlaygroundStore({
      datasetId: null,
      modelConfigByProvider: {},
    });
    const credentials = createCredentialsStore({}).getState();
    const instanceId = playgroundStore.getState().instances[0].id;
    playgroundStore.getState().updateModel({
      instanceId,
      patch: { openaiApiType: "CHAT_COMPLETIONS" },
    });

    const input = getChatCompletionInput({
      playgroundStore,
      instanceId,
      credentials,
    });

    expect(input.connectionConfig?.openaiApiType).toBe("CHAT_COMPLETIONS");
  });
});
