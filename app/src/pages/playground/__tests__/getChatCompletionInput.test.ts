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

describe("getChatCompletionInput media variables", () => {
  /**
   * A media variable's value is a `phoenix://media/<sha256>` reference, and the
   * server substitutes it out of `template.variables` like any other variable. So
   * the run payload has to carry it: if it does not, the prompt runs with the media
   * slot unfilled and the model simply never sees the file — no error anywhere.
   *
   * Media variables are declared by a message part rather than by template syntax,
   * which is why this holds even when the template format is NONE.
   */
  it.each(["MUSTACHE", "NONE"] as const)(
    "sends a declared media variable's value with format %s",
    (templateFormat) => {
      const playgroundStore = createPlaygroundStore({
        datasetId: null,
        modelConfigByProvider: {},
      });
      const credentials = createCredentialsStore({}).getState();
      const state = playgroundStore.getState();
      const instanceId = state.instances[0].id;
      const template = state.instances[0].template;
      if (template.__type !== "chat") {
        throw new Error("expected a chat template");
      }
      const messageId = template.messageIds[0];

      state.setTemplateFormat(templateFormat);
      state.updateMessage({
        instanceId,
        messageId,
        patch: {
          role: "user",
          imageVariables: [{ image: { variable: "screenshot" } }],
        },
      });
      playgroundStore
        .getState()
        .setVariableValue("screenshot", "phoenix://media/abc123");

      const input = getChatCompletionInput({
        playgroundStore,
        instanceId,
        credentials,
      });

      expect(input.template?.variables).toMatchObject({
        screenshot: "phoenix://media/abc123",
      });
    }
  );
});
