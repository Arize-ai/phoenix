import { Suspense, useState, type ReactNode, type RefObject } from "react";

import { ChatSessionUsage } from "@phoenix/components/agent/ChatSessionUsage";
import { Loading } from "@phoenix/components/core";
import { useAgentContext } from "@phoenix/contexts/AgentContext";

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
import { useAssistantAgentEnabled } from "./useAssistantAgentEnabled";
import type { AgentModelSelection } from "./useGenerateSessionSummary";

type FloatingAgentChatPanelProps = {
  /**
   * Optional element that scopes the panel's default position and clamping.
   * When omitted, the panel falls back to the visual viewport.
   */
  boundaryRef?: RefObject<HTMLElement | null>;
};

type AgentChatSurfaceProps = {
  renderFrame: (children: ReactNode) => ReactNode;
};

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

/**
 * Controller for the assistant's floating chat surface.
 */
export function FloatingAgentChatPanel({
  boundaryRef,
}: FloatingAgentChatPanelProps) {
  const fabPlacement = useAgentContext((state) => state.fabPlacement);
  const [panelSize, setPanelSize] = useState(DEFAULT_FLOATING_AGENT_CHAT_SIZE);

  return (
    <AgentChatSurface
      renderFrame={(children) => (
        <FloatingAgentChatFrame
          boundaryRef={boundaryRef}
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

function AgentChatSurface({ renderFrame }: AgentChatSurfaceProps) {
  const isAgentAssistantEnabled = useAssistantAgentEnabled();
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

  if (!isAgentAssistantEnabled) {
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
  isPositionChangeDisabled,
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
  position?: ReturnType<typeof useAgentChatPanelState>["position"];
  setPosition?: ReturnType<typeof useAgentChatPanelState>["setPosition"];
  isPositionChangeDisabled?: boolean;
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
    retryMessage,
    rewindToMessage,
    forkFromMessage,
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
        isPositionChangeDisabled={isPositionChangeDisabled}
        onSelectSession={setActiveSession}
        onDeleteSession={deleteSession}
        onCreateSession={createSession}
        onPositionChange={setPosition}
        onClose={closePanel}
      />
      {/* Catch runaway suspense triggers that aren't handled locally */}
      <Suspense fallback={<Loading />}>
        <ChatView
          key={activeSessionId ?? "no-session"}
          sessionId={activeSessionId}
          messages={messages}
          sendMessage={sendMessage}
          stop={stop}
          status={status}
          error={error}
          pendingElicitation={pendingElicitation}
          handleElicitationSubmit={handleElicitationSubmit}
          handleElicitationCancel={handleElicitationCancel}
          retryMessage={retryMessage}
          rewindToMessage={rewindToMessage}
          forkFromMessage={forkFromMessage}
          modelMenuValue={menuValue}
          onModelChange={handleModelChange}
          autoFocusInput
        >
          {activeSessionId ? (
            <ChatSessionUsage sessionId={activeSessionId} />
          ) : null}
        </ChatView>
      </Suspense>
    </>
  );
}
