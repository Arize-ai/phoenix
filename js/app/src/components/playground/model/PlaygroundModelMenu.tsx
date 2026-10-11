import type { ModelMenuValue } from "@phoenix/components/generative";
import { ModelMenu } from "@phoenix/components/generative";
import { DEFAULT_MODEL_PROVIDER } from "@phoenix/constants/generativeConstants";
import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";
import { usePreferencesContext } from "@phoenix/contexts/PreferencesContext";
import { createDecisionDraft } from "@phoenix/pages/playground/decisionUtils";

export type PlaygroundModelMenuProps = {
  /**
   * The playground instance ID to configure
   */
  playgroundInstanceId: number;
  /** Enable the Decision tab in the menu. */
  supportsDecisionModels?: boolean;
  /** Why decision models cannot be chosen right now, shown on the disabled tab. */
  decisionModelsDisabledReason?: string;
};

/**
 * Model menu for the playground that handles provider and model changes
 * through the playground store.
 */
export function PlaygroundModelMenu({
  playgroundInstanceId,
  supportsDecisionModels = false,
  decisionModelsDisabledReason,
}: PlaygroundModelMenuProps) {
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

  const handleChange = (model: ModelMenuValue) => {
    if (!instance) return;

    if (model.modelType === "DECISION") {
      const wasDecision = instance.model.modelType === "DECISION";
      updateInstance({
        instanceId: playgroundInstanceId,
        dirty: true,
        patch: {
          // Keep a request the instance already had; start one otherwise.
          decisionRequest: instance.decisionRequest ?? createDecisionDraft(),
          // Remember the chat configuration so switching back restores it.
          llmModel: wasDecision ? instance.llmModel : instance.model,
          model: {
            provider: model.provider,
            modelName: model.modelName,
            modelType: "DECISION",
            invocationParameters: instance.model.invocationParameters,
            // A base URL points at one provider's decision endpoint.
            baseUrl:
              wasDecision && model.provider === instance.model.provider
                ? instance.model.baseUrl
                : null,
          },
          prompt: null,
          repetitions: {},
          experiment: null,
        },
      });
      return;
    }

    if (instance.model.modelType === "DECISION") {
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
          model: { ...restoredModel, modelType: "LLM" },
          repetitions: {},
        },
      });
    }

    // Update provider if it changed
    const previousProvider =
      instance.model.modelType === "DECISION"
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
        modelType: "LLM",
      },
    });
  };

  if (!instance) {
    return null;
  }

  return (
    <ModelMenu
      value={value}
      onChange={handleChange}
      supportsDecisionModels={supportsDecisionModels}
      decisionModelsDisabledReason={decisionModelsDisabledReason}
      isDisabled={instance.activeRunId != null}
    />
  );
}
