import { useCallback, useMemo } from "react";

import type { AgentModelSelection } from "@phoenix/agent/chat/buildAgentChatRequestBody";
import type { paths } from "@phoenix/api/__generated__/v1";
import { useAgentContext } from "@phoenix/contexts/AgentContext";
import { prependBasename } from "@phoenix/utils/routingUtils";

import type { ModelMenuValue } from "../generative/ModelMenu";

const CHAT_PATH_TEMPLATE = "/agents/{agent_id}/chat" satisfies keyof paths;

const ASSISTANT_AGENT_ID = "assistant";

export function buildAgentModelSelection({
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
 * Encapsulates the non-visual state and side effects that drive
 * {@link AgentChatPanel}.
 *
 * Responsibilities:
 * - Derives the chat API URL and model menu value from the store
 */
export function useAgentChatPanelState() {
  const isOpen = useAgentContext((state) => state.isOpen);
  const setIsOpen = useAgentContext((state) => state.setIsOpen);
  const position = useAgentContext((state) => state.position);
  const setPosition = useAgentContext((state) => state.setPosition);
  const activeSessionId = useAgentContext((state) => state.activeSessionId);
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

  const modelSelection = useMemo<AgentModelSelection>(
    () => buildAgentModelSelection({ model: menuValue }),
    [menuValue]
  );

  const chatApiUrl = useMemo(
    () =>
      prependBasename(
        CHAT_PATH_TEMPLATE.replace("{agent_id}", ASSISTANT_AGENT_ID)
      ),
    []
  );

  const closePanel = useCallback(() => {
    setIsOpen(false);
  }, [setIsOpen]);

  return {
    isOpen,
    position,
    activeSessionId,
    chatApiUrl,
    modelSelection,
    menuValue,
    closePanel,
    setPosition,
    handleModelChange,
  };
}
