import { useEffect, useRef } from "react";

import { useAgentStore } from "@phoenix/contexts/AgentContext";
import { useFeatureFlag } from "@phoenix/contexts/FeatureFlagsContext";

import { AgentChatPanelView } from "./AgentChatPanelView";
import { ChatView } from "./Chat";
import {
  EMPTY_SESSION_DISPLAY_NAME,
  getSessionDisplayName,
} from "./sessionSummaryUtils";
import { useAgentChat } from "./useAgentChat";
import { useAgentChatPanelState } from "./useAgentChatPanelState";

/**
 * Always-mounted controller for the agent chat. The panel UI is conditional,
 * but the underlying chat hook stays mounted so in-flight streams survive
 * when the panel is closed.
 */
export function AgentChatPanel() {
  const isAgentsEnabled = useFeatureFlag("agents");
  const {
    isOpen,
    activeSessionId,
    orderedSessions,
    chatApiUrl,
    menuValue,
    createSession,
    setActiveSession,
    deleteSession,
    closePanel,
    handleModelChange,
  } = useAgentChatPanelState();

  const activeSession = orderedSessions.find(
    (session) => session.id === activeSessionId
  );
  const sessionDisplayName = activeSession
    ? getSessionDisplayName(activeSession)
    : EMPTY_SESSION_DISPLAY_NAME;

  if (!isAgentsEnabled) {
    return null;
  }

  return (
    <AgentChatController
      key={`${activeSessionId}-${chatApiUrl}`}
      isOpen={isOpen}
      activeSessionId={activeSessionId}
      orderedSessions={orderedSessions}
      sessionDisplayName={sessionDisplayName}
      chatApiUrl={chatApiUrl}
      menuValue={menuValue}
      createSession={createSession}
      setActiveSession={setActiveSession}
      deleteSession={deleteSession}
      closePanel={closePanel}
      handleModelChange={handleModelChange}
    />
  );
}

function AgentChatController({
  isOpen,
  activeSessionId,
  orderedSessions,
  sessionDisplayName,
  chatApiUrl,
  menuValue,
  createSession,
  setActiveSession,
  deleteSession,
  closePanel,
  handleModelChange,
}: {
  isOpen: boolean;
  activeSessionId: string | null;
  orderedSessions: ReturnType<typeof useAgentChatPanelState>["orderedSessions"];
  sessionDisplayName: string;
  chatApiUrl: string;
  menuValue: ReturnType<typeof useAgentChatPanelState>["menuValue"];
  createSession: ReturnType<typeof useAgentChatPanelState>["createSession"];
  setActiveSession: ReturnType<
    typeof useAgentChatPanelState
  >["setActiveSession"];
  deleteSession: ReturnType<typeof useAgentChatPanelState>["deleteSession"];
  closePanel: ReturnType<typeof useAgentChatPanelState>["closePanel"];
  handleModelChange: ReturnType<
    typeof useAgentChatPanelState
  >["handleModelChange"];
}) {
  const store = useAgentStore();

  const {
    messages,
    sendMessage,
    stop,
    status,
    error,
    pendingElicitation,
    handleElicitationSubmit,
    handleElicitationCancel,
  } = useAgentChat({
    sessionId: activeSessionId,
    chatApiUrl,
  });

  const previousSessionIdRef = useRef<string | null>(null);

  // Mirror the active chat status into the store so the FAB can reflect
  // background streaming while the panel itself is hidden.
  useEffect(() => {
    const previousSessionId = previousSessionIdRef.current;
    if (previousSessionId && previousSessionId !== activeSessionId) {
      store.getState().setSessionChatStatus(previousSessionId, "ready");
    }
    previousSessionIdRef.current = activeSessionId;
  }, [activeSessionId, store]);

  useEffect(() => {
    if (activeSessionId !== null) {
      store.getState().setSessionChatStatus(activeSessionId, status);
    }
  }, [activeSessionId, status, store]);

  useEffect(() => {
    return () => {
      const sessionId = previousSessionIdRef.current;
      if (sessionId !== null) {
        store.getState().setSessionChatStatus(sessionId, "ready");
      }
    };
  }, [store]);

  if (!isOpen) {
    return null;
  }

  return (
    <AgentChatPanelView
      sessionDisplayName={sessionDisplayName}
      orderedSessions={orderedSessions}
      activeSessionId={activeSessionId}
      onSelectSession={setActiveSession}
      onDeleteSession={deleteSession}
      onCreateSession={createSession}
      onClose={closePanel}
    >
      <ChatView
        messages={messages}
        sendMessage={sendMessage}
        stop={stop}
        status={status}
        error={error}
        pendingElicitation={pendingElicitation}
        handleElicitationSubmit={handleElicitationSubmit}
        handleElicitationCancel={handleElicitationCancel}
        modelMenuValue={menuValue}
        onModelChange={handleModelChange}
      />
    </AgentChatPanelView>
  );
}
