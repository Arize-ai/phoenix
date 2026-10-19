import { useCallback } from "react";
import { useSearchParams } from "react-router";

import type { ModelMenuValue } from "@phoenix/components/generative";
import { ModelMenu } from "@phoenix/components/generative";
import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";
import { usePreferencesContext } from "@phoenix/contexts/PreferencesContext";
import { createDecisionDraft } from "@phoenix/pages/playground/decisionUtils";

export type PlaygroundModelMenuProps = {
  /**
   * The playground instance ID to configure
   */
  playgroundInstanceId: number;
  supportsDecisionModels?: boolean;
};

/**
 * A model selection menu connected to the playground store.
 * Handles both provider and model name updates when a model is selected.
 */
export function PlaygroundModelMenu({
  playgroundInstanceId,
  supportsDecisionModels = false,
}: PlaygroundModelMenuProps) {
  const instance = usePlaygroundContext((state) =>
    state.instances.find((instance) => instance.id === playgroundInstanceId)
  );

  const updateProvider = usePlaygroundContext((state) => state.updateProvider);
  const updateModel = usePlaygroundContext((state) => state.updateModel);
  const updateInstance = usePlaygroundContext((state) => state.updateInstance);
  const [searchParams, setSearchParams] = useSearchParams();
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

  const handleChange = useCallback(
    (model: ModelMenuValue) => {
      if (!instance) return;

      if (model.modelType === "DECISION") {
        updateInstance({
          instanceId: playgroundInstanceId,
          dirty: true,
          patch: {
            llmModel:
              instance.model.modelType === "DECISION"
                ? instance.llmModel
                : instance.model,
            model: {
              provider: model.provider,
              modelName: model.modelName,
              modelType: "DECISION",
              invocationParameters: instance.model.invocationParameters,
              baseUrl:
                instance.model.modelType === "DECISION" &&
                model.provider === instance.model.provider
                  ? instance.model.baseUrl
                  : null,
            },
            decision: instance.decision ?? createDecisionDraft(),
            prompt: null,
            repetitions: {},
            experiment: null,
          },
        });
        const params = new URLSearchParams(searchParams);
        params.set("modelType", "DECISION");
        params.set("decisionProvider", model.provider);
        params.set("decisionModel", model.modelName);
        setSearchParams(params, { replace: true });
        return;
      }
      if (instance.model.modelType === "DECISION") {
        const params = new URLSearchParams(searchParams);
        params.delete("modelType");
        params.delete("decisionProvider");
        params.delete("decisionModel");
        setSearchParams(params, { replace: true });
        // Restore the conversation's config before any provider conversion.
        updateInstance({
          instanceId: playgroundInstanceId,
          dirty: true,
          patch: {
            model: {
              ...(instance.llmModel ?? instance.model),
              provider: instance.llmModel?.provider ?? "OPENAI",
              modelType: "LLM",
            },
            repetitions: {},
          },
        });
      }

      // Update provider if it changed
      const previousProvider =
        instance.model.modelType === "DECISION"
          ? (instance.llmModel?.provider ?? "OPENAI")
          : instance.model.provider;
      if (model.provider !== previousProvider) {
        updateProvider({
          instanceId: playgroundInstanceId,
          provider: model.provider,
          modelConfigByProvider,
        });
      }

      // Update model name and custom provider info
      updateModel({
        instanceId: playgroundInstanceId,
        patch: {
          modelName: model.modelName,
          customProvider: model.customProvider ?? null,
          modelType: "LLM",
        },
      });
    },
    [
      instance,
      playgroundInstanceId,
      updateProvider,
      updateModel,
      modelConfigByProvider,
      updateInstance,
      searchParams,
      setSearchParams,
    ]
  );

  if (!instance) {
    return null;
  }

  return (
    <ModelMenu
      value={value}
      onChange={handleChange}
      supportsDecisionModels={supportsDecisionModels}
      isDisabled={instance.activeRunId != null}
    />
  );
}
