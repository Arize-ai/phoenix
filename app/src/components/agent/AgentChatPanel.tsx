import { Suspense, useState, type ReactNode } from "react";

import { ChatSessionUsage } from "@phoenix/components/agent/ChatSessionUsage";
import { Loading } from "@phoenix/components/core";
import { useAgentContext } from "@phoenix/contexts/AgentContext";
import { useFeatureFlag } from "@phoenix/contexts/FeatureFlagsContext";

import {
  AgentChatHeader,
  DEFAULT_FLOATING_AGENT_CHAT_SIZE,
  DockedAgentChatFrame,
  FloatingAgentChatFrame,
} from "./AgentChatPanelView";
import { ChatView } from "./Chat";
import {
  EMPTY_SESSION_DISPLAY_NAME,
  getSessionDisplayName,
} from "./sessionSummaryUtils";
import { useAgentChat } from "./useAgentChat";
import { useAgentChatPanelState } from "./useAgentChatPanelState";
import type { AgentModelSelection } from "./useGenerateSessionSummary";

/**
 * Controller for the pinned side-panel agent chat.
 */
export function AgentChatPanel() {
  return (
    <AgentChatSurface
      renderFrame={(children) => (
        <DockedAgentChatFrame>{children}</DockedAgentChatFrame>
      )}
    />
  );
}

export function FloatingAgentChatPanel() {
  const fabPlacement = useAgentContext((state) => state.fabPlacement);
  const [panelSize, setPanelSize] = useState(DEFAULT_FLOATING_AGENT_CHAT_SIZE);

  return (
    <AgentChatSurface
      renderFrame={(children) => (
        <FloatingAgentChatFrame
          placement={fabPlacement}
          size={panelSize}
          onSizeChange={setPanelSize}
        >
          {children}
        </FloatingAgentChatFrame>
      )}
    />
  );
}

function AgentChatSurface({
  renderFrame,
}: {
  renderFrame: (children: ReactNode) => ReactNode;
}) {
  const isAgentsEnabled = useFeatureFlag("agents");
  const {
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
      showSessionHistory={showSessionHistory}
      sessionDisplayName={sessionDisplayName}
      chatApiUrl={chatApiUrl}
      modelSelection={modelSelection}
      menuValue={menuValue}
      createSession={createSession}
      setActiveSession={setActiveSession}
      deleteSession={deleteSession}
      closePanel={closePanel}
      position={position}
      setPosition={setPosition}
      handleModelChange={handleModelChange}
      renderFrame={renderFrame}
    />
  );
}

function AgentChatController({
  isOpen,
  activeSessionId,
  orderedSessions,
  showSessionHistory,
  sessionDisplayName,
  chatApiUrl,
  modelSelection,
  menuValue,
  createSession,
  setActiveSession,
  deleteSession,
  closePanel,
  position,
  setPosition,
  handleModelChange,
  renderFrame,
}: {
  isOpen: boolean;
  activeSessionId: string | null;
  orderedSessions: ReturnType<typeof useAgentChatPanelState>["orderedSessions"];
  showSessionHistory: ReturnType<
    typeof useAgentChatPanelState
  >["showSessionHistory"];
  sessionDisplayName: string;
  chatApiUrl: string;
  modelSelection: AgentModelSelection;
  menuValue: ReturnType<typeof useAgentChatPanelState>["menuValue"];
  createSession: ReturnType<typeof useAgentChatPanelState>["createSession"];
  setActiveSession: ReturnType<
    typeof useAgentChatPanelState
  >["setActiveSession"];
  deleteSession: ReturnType<typeof useAgentChatPanelState>["deleteSession"];
  closePanel: ReturnType<typeof useAgentChatPanelState>["closePanel"];
  position: ReturnType<typeof useAgentChatPanelState>["position"];
  setPosition: ReturnType<typeof useAgentChatPanelState>["setPosition"];
  handleModelChange: ReturnType<
    typeof useAgentChatPanelState
  >["handleModelChange"];
  renderFrame: (children: ReactNode) => ReactNode;
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
    modelSelection,
  });

  if (!isOpen) {
    return null;
  }

  return renderFrame(
    <>
      <AgentChatHeader
        sessionDisplayName={sessionDisplayName}
        orderedSessions={orderedSessions}
        activeSessionId={activeSessionId}
        showSessionHistory={showSessionHistory}
        position={position}
        onSelectSession={setActiveSession}
        onDeleteSession={deleteSession}
        onCreateSession={createSession}
        onPositionChange={setPosition}
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
    </>
  );
}
