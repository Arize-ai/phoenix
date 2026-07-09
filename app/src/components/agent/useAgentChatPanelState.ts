import { useCallback, useEffect, useMemo } from "react";

import type { AgentModelSelection } from "@phoenix/agent/chat/buildAgentChatRequestBody";
import type { paths } from "@phoenix/api/__generated__/v1";
import { useAgentContext } from "@phoenix/contexts/AgentContext";
import { prependBasename } from "@phoenix/utils/routingUtils";

import type { ModelMenuValue } from "../generative/ModelMenu";
import { useAgentServerSessions } from "./useAgentServerSessions";

const CHAT_PATH_TEMPLATE =
  "/agents/{agent_id}/sessions/{session_id}/chat" satisfies keyof paths;

const ASSISTANT_AGENT_ID = "assistant";

/**
 * Encapsulates the non-visual state and side effects that drive
 * {@link AgentChatPanel}.
 *
 * Responsibilities:
 * - Hydrates the session list from the server when the panel opens
 * - Resumes the most recent persisted session, or starts a fresh one
 * - Derives the chat API URL and model menu value from the store
 */
export function useAgentChatPanelState() {
  const isOpen = useAgentContext((state) => state.isOpen);
  const setIsOpen = useAgentContext((state) => state.setIsOpen);
  const position = useAgentContext((state) => state.position);
  const setPosition = useAgentContext((state) => state.setPosition);
  const activeSessionId = useAgentContext((state) => state.activeSessionId);
  const createSession = useAgentContext((state) => state.createSession);
  const setActiveSessionInStore = useAgentContext(
    (state) => state.setActiveSession
  );
  const sessionIds = useAgentContext((state) => state.sessions);
  const sessionMap = useAgentContext((state) => state.sessionMap);
  const serverSessionsHydration = useAgentContext(
    (state) => state.serverSessionsHydration
  );
  const showSessionHistory = useAgentContext(
    (state) => state.capabilities["session.storeSessions"]
  );
  const defaultModelConfig = useAgentContext(
    (state) => state.defaultModelConfig
  );
  const setDefaultModelConfig = useAgentContext(
    (state) => state.setDefaultModelConfig
  );
  const { hydrateSessions, activateSession, deleteSession } =
    useAgentServerSessions();

  // Derive full session objects in newest-first order for the session list.
  const orderedSessions = useMemo(() => {
    const sessions = sessionIds
      .map((sessionId) => sessionMap[sessionId])
      .filter(Boolean);
    // Reverse so newest sessions appear first
    return sessions.reverse();
  }, [sessionIds, sessionMap]);

  // Sessions persist only in the database, so the list must be hydrated over
  // the network before deciding what to show. Kicked off on first open.
  useEffect(() => {
    if (isOpen) {
      void hydrateSessions();
    }
  }, [isOpen, hydrateSessions]);

  // Once hydration settles, resume the most recent persisted session; when
  // there is none (or hydration failed), start a fresh session.
  useEffect(() => {
    if (!isOpen || activeSessionId !== null) {
      return;
    }
    if (
      serverSessionsHydration === "idle" ||
      serverSessionsHydration === "pending"
    ) {
      return;
    }
    const mostRecentSessionId = sessionIds[sessionIds.length - 1];
    if (mostRecentSessionId) {
      void activateSession(mostRecentSessionId);
    } else {
      createSession();
    }
  }, [
    isOpen,
    activeSessionId,
    serverSessionsHydration,
    sessionIds,
    activateSession,
    createSession,
  ]);

  // Activating a session may need a network fetch of its transcript first;
  // clearing the active session (null) stays synchronous.
  const setActiveSession = useCallback(
    (sessionId: string | null) => {
      if (sessionId === null) {
        setActiveSessionInStore(null);
        return;
      }
      void activateSession(sessionId);
    },
    [activateSession, setActiveSessionInStore]
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
