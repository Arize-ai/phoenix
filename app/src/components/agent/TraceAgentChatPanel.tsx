import { useFeatureFlag } from "@phoenix/contexts/FeatureFlagsContext";

import { AgentChatHeader, TraceAgentChatFrame } from "./AgentChatPanelView";
import { ChatView } from "./Chat";
import {
  EMPTY_SESSION_DISPLAY_NAME,
  getSessionDisplayName,
} from "./sessionSummaryUtils";
import { useAgentChat } from "./useAgentChat";
import { useAgentChatPanelState } from "./useAgentChatPanelState";

export function TraceAgentChatPanel() {
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

  if (!isAgentsEnabled || !isOpen) {
    return null;
  }

  return (
    <TraceAgentChatFrame>
      <AgentChatHeader
        sessionDisplayName={sessionDisplayName}
        orderedSessions={orderedSessions}
        activeSessionId={activeSessionId}
        onSelectSession={setActiveSession}
        onDeleteSession={deleteSession}
        onCreateSession={createSession}
        onClose={closePanel}
      />
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
    </TraceAgentChatFrame>
  );
}
