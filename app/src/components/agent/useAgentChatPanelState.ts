import { useCallback, useMemo } from "react";

import { buildAgentModelSelectionFromConfig } from "@phoenix/agent/chat/agentModelSelection";
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
  return buildAgentModelSelectionFromConfig({
    provider: model.provider,
    modelName: model.modelName,
    invocationParameters: {},
    customProvider: model.customProvider ?? null,
  });
}

/**
 * Encapsulates the non-visual state and side effects that drive
 * {@link AgentChatPanel}.
 *
 * Responsibilities:
 * - Derives the chat API URL and model menu value from the store
 */
export function useAgentChatPanelState(sessionId?: string | null) {
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
  const targetSessionId = sessionId === undefined ? activeSessionId : sessionId;
  const sessionModelConfig = useAgentContext((state) =>
    targetSessionId
      ? state.sessionStateById[targetSessionId]?.modelConfig
      : undefined
  );
  const updateSessionModelConfig = useAgentContext(
    (state) => state.updateSessionModelConfig
  );
  const modelConfig = sessionModelConfig ?? defaultModelConfig;

  const menuValue: ModelMenuValue = useMemo(
    () => ({
      provider: modelConfig.provider,
      modelName: modelConfig.modelName ?? "",
      ...(modelConfig.customProvider && {
        customProvider: modelConfig.customProvider,
      }),
    }),
    [modelConfig]
  );

  const handleModelChange = useCallback(
    (model: ModelMenuValue) => {
      if (!targetSessionId || !sessionModelConfig) {
        return;
      }
      updateSessionModelConfig(targetSessionId, {
        provider: model.provider,
        modelName: model.modelName,
        customProvider: model.customProvider ?? null,
      });
      setDefaultModelConfig({
        ...sessionModelConfig,
        provider: model.provider,
        modelName: model.modelName,
        customProvider: model.customProvider ?? null,
      });
    },
    [
      sessionModelConfig,
      setDefaultModelConfig,
      targetSessionId,
      updateSessionModelConfig,
    ]
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
