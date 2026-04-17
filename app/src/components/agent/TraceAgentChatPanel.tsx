import { ChatSessionUsage } from "@phoenix/components/agent/ChatSessionUsage";
import { useFeatureFlag } from "@phoenix/contexts/FeatureFlagsContext";

import { AgentChatHeader, TraceAgentChatFrame } from "./AgentChatPanelView";
import { ChatView } from "./Chat";
import {
  EMPTY_SESSION_DISPLAY_NAME,
  getSessionDisplayName,
} from "./sessionSummaryUtils";
import { useActiveChatPanelWhileMounted } from "./useActiveChatPanelWhileMounted";
import { useAgentChat } from "./useAgentChat";
import { useAgentChatPanelState } from "./useAgentChatPanelState";

/**
 * Agent chat panel embedded inside the trace slideover.
 *
 * Claims `activePanelLocation = "trace"` while mounted so the Layout
 * suppresses the docked panel. Released back to `"docked"` on unmount.
 */
export function TraceAgentChatPanel() {
  const isAgentsEnabled = useFeatureFlag("agents");
  const { isOpen } = useAgentChatPanelState();
  useActiveChatPanelWhileMounted("trace");

  if (!isAgentsEnabled || !isOpen) {
    return null;
  }

  return <TraceAgentChatController />;
}

/**
 * Inner controller that only mounts when agents are enabled and the panel is
 * open. This avoids running useAgentChat (which registers a Chat instance in
 * the runtime) when it's not needed.
 */
function TraceAgentChatController() {
  const {
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
      >
        {activeSessionId ? (
          <ChatSessionUsage sessionId={activeSessionId} />
        ) : null}
      </ChatView>
    </TraceAgentChatFrame>
  );
}
