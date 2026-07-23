import { useCallback, useMemo } from "react";

import type { AgentModelSelection } from "@phoenix/agent/chat/buildAgentChatRequestBody";
import { useAgentContext } from "@phoenix/contexts/AgentContext";
import type { AgentState } from "@phoenix/store/agentStore";

import type { ModelMenuValue } from "../generative/ModelMenu";

export function buildAgentModel({
  model,
}: {
  model: ModelMenuValue;
}): AgentModelSelection {
  if (model.customProvider) {
    return {
      providerType: "custom",
      providerId: model.customProvider.id,
      modelName: model.modelName,
    };
  }

  const isOpenAIProvider =
    model.provider === "OPENAI" || model.provider === "AZURE_OPENAI";
  return {
    providerType: "builtin",
    provider: model.provider,
    modelName: model.modelName,
    ...(isOpenAIProvider && { openaiApiType: "responses" }),
  };
}

/**
 * Derives the chat request's model selection from the store's current default
 * model config. The chat transport reads this at request time so a model
 * change always applies to the next send, even when the runtime chat was
 * created by a since-unmounted surface (e.g. the draft that started the
 * session).
 */
export function selectAgentModel(
  state: Pick<AgentState, "defaultModelConfig">
): AgentModelSelection {
  const { defaultModelConfig } = state;
  return buildAgentModel({
    model: {
      provider: defaultModelConfig.provider,
      modelName: defaultModelConfig.modelName ?? "",
      ...(defaultModelConfig.customProvider && {
        customProvider: defaultModelConfig.customProvider,
      }),
    },
  });
}

/**
 * Encapsulates the non-visual state and side effects that drive
 * {@link AgentChatPanel}.
 *
 * Responsibilities:
 * - Derives the model menu value from the store
 */
export function useAgentChatPanelState() {
  const isOpen = useAgentContext((state) => state.isOpen);
  const setIsOpen = useAgentContext((state) => state.setIsOpen);
  const position = useAgentContext((state) => state.position);
  const setPosition = useAgentContext((state) => state.setPosition);
  const defaultModelConfig = useAgentContext(
    (state) => state.defaultModelConfig
  );
  const setDefaultModelConfig = useAgentContext(
    (state) => state.setDefaultModelConfig
  );

  const menuValue: ModelMenuValue = useMemo(
    () => ({
      provider: defaultModelConfig.provider,
      modelName: defaultModelConfig.modelName ?? "",
      ...(defaultModelConfig.customProvider && {
        customProvider: defaultModelConfig.customProvider,
      }),
    }),
    [defaultModelConfig]
  );

  const handleModelChange = useCallback(
    (model: ModelMenuValue) => {
      setDefaultModelConfig({
        ...defaultModelConfig,
        provider: model.provider,
        modelName: model.modelName,
        customProvider: model.customProvider ?? null,
      });
    },
    [defaultModelConfig, setDefaultModelConfig]
  );

  const closePanel = useCallback(() => {
    setIsOpen(false);
  }, [setIsOpen]);

  return {
    isOpen,
    position,
    menuValue,
    closePanel,
    setPosition,
    handleModelChange,
  };
}
