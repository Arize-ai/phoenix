import type {
  ModelCredentialSource,
  ModelMenuValue,
} from "@phoenix/components/generative";
import { ModelMenu } from "@phoenix/components/generative";
import {
  createDecisionDraft,
  getChatForDecisionToPrompt,
} from "@phoenix/components/playground/decisionUtils";
import { DEFAULT_MODEL_PROVIDER } from "@phoenix/constants/generativeConstants";
import {
  usePlaygroundContext,
  usePlaygroundStore,
} from "@phoenix/contexts/PlaygroundContext";
import { usePreferencesContext } from "@phoenix/contexts/PreferencesContext";
import { generateMessageId, isDecisionInstance } from "@phoenix/store";
import { selectPlaygroundInstanceDecisionPrompt } from "@phoenix/store/playground/selectors";

import type { InstanceModelTypes } from "./modelControlTypes";

export type PlaygroundModelMenuProps = {
  /**
   * The playground instance ID to configure
   */
  playgroundInstanceId: number;
  /** The model types the menu offers. Defaults to chat models only. */
  modelTypes?: InstanceModelTypes;
  credentialSource?: ModelCredentialSource;
};

/**
 * Model menu for the playground that handles provider and model changes
 * through the playground store.
 */
export function PlaygroundModelMenu({
  playgroundInstanceId,
  modelTypes = "CHAT",
  credentialSource,
}: PlaygroundModelMenuProps) {
  const store = usePlaygroundStore();
  const instance = usePlaygroundContext((state) =>
    state.instances.find((instance) => instance.id === playgroundInstanceId)
  );
  const updateProvider = usePlaygroundContext((state) => state.updateProvider);
  const updateModel = usePlaygroundContext((state) => state.updateModel);
  const updateInstance = usePlaygroundContext((state) => state.updateInstance);
  const modelConfigByProvider = usePreferencesContext(
    (state) => state.modelConfigByProvider
  );

  const value: ModelMenuValue | null = instance?.model.modelName
    ? {
        provider: instance.model.provider,
        modelName: instance.model.modelName,
        modelType: instance.model.modelType,
        customProvider: instance.model.customProvider ?? undefined,
      }
    : null;

  const selectDecisionModel = (model: ModelMenuValue) => {
    if (!instance) return;
    const wasDecision = isDecisionInstance(instance);
    // A base URL belongs to one built-in provider's decision host, so keep it
    // only when this instance was already a decision on that provider. Azure's
    // resource endpoint is shared with chat, so it also survives switching
    // that provider from chat to a decision.
    const sameBuiltInProvider =
      model.customProvider == null &&
      instance.model.customProvider == null &&
      model.provider === instance.model.provider;
    updateInstance({
      instanceId: playgroundInstanceId,
      dirty: true,
      patch: {
        task: { type: "decision" },
        // Remember the chat configuration so switching back restores it.
        llmModel: wasDecision ? instance.llmModel : instance.model,
        model: {
          provider: model.provider,
          modelName: model.modelName,
          modelType: "DECISION",
          invocationParameters: instance.model.invocationParameters,
          customProvider: model.customProvider ?? null,
          baseUrl:
            sameBuiltInProvider && wasDecision
              ? (instance.model.baseUrl ?? null)
              : null,
          endpoint:
            sameBuiltInProvider && model.provider === "AZURE_OPENAI"
              ? (instance.model.endpoint ?? null)
              : null,
        },
        prompt: null,
        repetitions: {},
        experiment: null,
      },
    });
    // Keep a decision prompt the instance already had; start one otherwise.
    if (instance.decisionPromptId == null) {
      store.getState().updateDecisionPrompt({
        instanceId: playgroundInstanceId,
        request: createDecisionDraft(),
      });
    }
  };

  const handleChange = (model: ModelMenuValue) => {
    if (!instance) return;

    // The picker's Decision tab is a shortcut for the task's type: a
    // decision model makes the instance a decision, an LLM a prompt.
    if (model.modelType === "DECISION") {
      selectDecisionModel(model);
      return;
    }

    const wasDecision = isDecisionInstance(instance);
    const chat = wasDecision
      ? getChatForDecisionToPrompt({
          instance,
          decisionPrompt: selectPlaygroundInstanceDecisionPrompt(
            playgroundInstanceId
          )(store.getState()),
        })
      : null;
    if (wasDecision) {
      // Restore the chat configuration the instance had before it became a
      // decision instance. Without one, start from a clean chat model: the
      // decision base URL points at a decision endpoint, not a chat one.
      const restoredModel = instance.llmModel ?? {
        ...instance.model,
        provider: DEFAULT_MODEL_PROVIDER,
        baseUrl: null,
      };
      updateInstance({
        instanceId: playgroundInstanceId,
        dirty: true,
        patch: {
          task: { type: "prompt" },
          model: { ...restoredModel, modelType: "CHAT" },
          repetitions: {},
        },
      });
    }

    // Update provider if it changed
    const previousProvider = wasDecision
      ? (instance.llmModel?.provider ?? DEFAULT_MODEL_PROVIDER)
      : instance.model.provider;
    if (model.provider !== previousProvider) {
      updateProvider({
        instanceId: playgroundInstanceId,
        provider: model.provider,
        modelConfigByProvider,
      });
    }

    // Update model name and custom provider ref
    updateModel({
      instanceId: playgroundInstanceId,
      patch: {
        modelName: model.modelName,
        customProvider: model.customProvider ?? null,
        modelType: "CHAT",
        ...(chat ? { responseFormat: chat.responseFormat } : {}),
      },
    });
    if (chat) {
      store.getState().addMessage({
        playgroundInstanceId,
        messages: chat.messages.map((message) => ({
          ...message,
          id: generateMessageId(),
        })),
      });
    }
  };

  if (!instance) {
    return null;
  }

  return (
    <ModelMenu
      value={value}
      onChange={handleChange}
      supportsDecisionModels={modelTypes !== "CHAT"}
      // A decision task with no model picked yet opens on the Decision tab.
      defaultModelType={isDecisionInstance(instance) ? "DECISION" : "CHAT"}
      fixedModelType={modelTypes === "DECISION" ? "DECISION" : undefined}
      credentialSource={credentialSource}
      isDisabled={instance.activeRunId != null}
    />
  );
}
