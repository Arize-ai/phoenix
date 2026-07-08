import { useCallback, useEffect, useMemo } from "react";

import type { paths } from "@phoenix/api/__generated__/v1";
import { useAgentContext } from "@phoenix/contexts/AgentContext";
import { prependBasename } from "@phoenix/utils/routingUtils";

import type { ModelMenuValue } from "../generative/ModelMenu";
import type { AgentModelSelection } from "./useGenerateSessionSummary";

const CHAT_PATH_TEMPLATE =
  "/agents/{agent_id}/sessions/{session_id}/chat" satisfies keyof paths;

const ASSISTANT_AGENT_ID = "assistant";

/**
 * Encapsulates the non-visual state and side effects that drive
 * {@link AgentChatPanel}.
 *
 * Responsibilities:
 * - Creates a session automatically when the panel opens
 * - Derives the chat API URL and model menu value from the store
 */
export function useAgentChatPanelState() {
  const isOpen = useAgentContext((state) => state.isOpen);
  const setIsOpen = useAgentContext((state) => state.setIsOpen);
  const position = useAgentContext((state) => state.position);
  const setPosition = useAgentContext((state) => state.setPosition);
  const activeSessionId = useAgentContext((state) => state.activeSessionId);
  const createSession = useAgentContext((state) => state.createSession);
  const setActiveSession = useAgentContext((state) => state.setActiveSession);
  const deleteSession = useAgentContext((state) => state.deleteSession);
  const sessionIds = useAgentContext((state) => state.sessions);
  const sessionMap = useAgentContext((state) => state.sessionMap);
  const showSessionHistory = useAgentContext(
    (state) => state.capabilities["session.storeSessions"]
  );
  const defaultModelConfig = useAgentContext(
    (state) => state.defaultModelConfig
  );
  const setDefaultModelConfig = useAgentContext(
    (state) => state.setDefaultModelConfig
  );

  // Derive full session objects in newest-first order for the session list.
  const orderedSessions = useMemo(() => {
    const sessions = sessionIds
      .map((sessionId) => sessionMap[sessionId])
      .filter(Boolean);
    // Reverse so newest sessions appear first
    return sessions.reverse();
  }, [sessionIds, sessionMap]);

  useEffect(() => {
    if (isOpen && activeSessionId === null) {
      createSession();
    }
  }, [isOpen, activeSessionId, createSession]);

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
    () =>
      menuValue.customProvider
        ? {
            providerType: "custom",
            providerId: menuValue.customProvider.id,
            modelName: menuValue.modelName,
          }
        : {
            providerType: "builtin",
            provider: menuValue.provider,
            modelName: menuValue.modelName,
          },
    [menuValue]
  );

  const chatApiUrl = useMemo(() => {
    // The session id is part of the path so the URL is session-scoped. Until
    // a session exists the chat hook short-circuits all network activity, so
    // this empty string is never actually fetched.
    if (activeSessionId === null) return "";
    const path = CHAT_PATH_TEMPLATE.replace(
      "{agent_id}",
      ASSISTANT_AGENT_ID
    ).replace("{session_id}", encodeURIComponent(activeSessionId));
    return prependBasename(path);
  }, [activeSessionId]);

  const closePanel = useCallback(() => {
    setIsOpen(false);
  }, [setIsOpen]);

  return {
    isOpen,
    position,
    activeSessionId,
    orderedSessions,
    showSessionHistory,
    chatApiUrl,
    modelSelection,
    menuValue,
    createSession,
    setActiveSession,
    deleteSession,
    closePanel,
    setPosition,
    handleModelChange,
  };
}
