import { Suspense } from "react";

import { ChatSessionUsage } from "@phoenix/components/agent/ChatSessionUsage";
import { Loading } from "@phoenix/components/core";
import { useFeatureFlag } from "@phoenix/contexts/FeatureFlagsContext";

import { AgentChatHeader, DockedAgentChatFrame } from "./AgentChatPanelView";
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

  if (!isOpen) {
    return null;
  }

  return (
    <DockedAgentChatFrame>
      <AgentChatHeader
        sessionDisplayName={sessionDisplayName}
        orderedSessions={orderedSessions}
        activeSessionId={activeSessionId}
        onSelectSession={setActiveSession}
        onDeleteSession={deleteSession}
        onCreateSession={createSession}
        onClose={closePanel}
      />
      {/* Catch runaway suspense triggers that aren't handled locally */}
      <Suspense fallback={<Loading />}>
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
        >
          {activeSessionId ? (
            <ChatSessionUsage sessionId={activeSessionId} />
          ) : null}
        </ChatView>
      </Suspense>
    </DockedAgentChatFrame>
  );
}
