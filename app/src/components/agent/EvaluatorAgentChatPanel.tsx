import { Suspense } from "react";

import { ChatSessionUsage } from "@phoenix/components/agent/ChatSessionUsage";
import { Loading } from "@phoenix/components/core/loading";
import { useFeatureFlag } from "@phoenix/contexts/FeatureFlagsContext";

import { AgentChatHeader, EvaluatorAgentChatFrame } from "./AgentChatPanelView";
import { ChatView } from "./Chat";
import {
  EMPTY_SESSION_DISPLAY_NAME,
  getSessionDisplayName,
} from "./sessionSummaryUtils";
import { useActiveChatPanelWhileMounted } from "./useActiveChatPanelWhileMounted";
import { useAgentChat } from "./useAgentChat";
import { useAgentChatPanelState } from "./useAgentChatPanelState";

/**
 * Agent chat panel embedded inside the code evaluator slideover.
 *
 * Claims `activePanelLocation = "evaluator"` while mounted so the Layout
 * suppresses the docked panel. Released back to `"docked"` on unmount.
 *
 * The Frame (Separator + Panel) renders eagerly so the surrounding Group
 * layout is stable. The Suspense boundary inside the Panel isolates any
 * suspending work in the chat controller from the evaluator dialog content
 * sitting in a sibling Panel — without it, an agent-side suspension would
 * bubble up past the dialog's Suspense and remount/refetch the editor.
 */
export function EvaluatorAgentChatPanel() {
  const isAgentsEnabled = useFeatureFlag("agents");
  const { isOpen } = useAgentChatPanelState();
  useActiveChatPanelWhileMounted("evaluator");

  if (!isAgentsEnabled || !isOpen) {
    return null;
  }

  return (
    <EvaluatorAgentChatFrame>
      <Suspense fallback={<Loading />}>
        <EvaluatorAgentChatController />
      </Suspense>
    </EvaluatorAgentChatFrame>
  );
}

function EvaluatorAgentChatController() {
  const {
    activeSessionId,
    orderedSessions,
    chatApiUrl,
    modelSelection,
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
    modelSelection,
  });

  return (
    <>
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
    </>
  );
}
