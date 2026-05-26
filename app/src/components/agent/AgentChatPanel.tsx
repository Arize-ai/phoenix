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

type AgentChatPanelLayer = "content" | "modal";

type FloatingAgentChatPanelProps = {
  /**
   * Controls which stacking and interaction layer owns the floating panel.
   *
   * - `content` is the normal floating assistant surface rendered over page
   *   content. It reflects the user's persisted pinned/detached preference and
   *   may expose controls that change that preference.
   * - `modal` is a temporary modal-scoped surface used while a modal or
   *   slideover is active. It portals into the active modal's portal container
   *   so React Aria keeps the assistant interactive instead of marking it inert.
   */
  layer?: AgentChatPanelLayer;
};

type AgentChatSurfaceProps = {
  renderFrame: (children: ReactNode) => ReactNode;
  /**
   * Whether the header should expose controls for switching between pinned and
   * detached assistant layouts.
   *
   * Modal-layer panels intentionally hide these controls because that layer is
   * forced by the currently active modal, not by the user's saved layout
   * preference. Showing the pin/detach toggle there would imply the user can
   * dock PXI behind the modal, which would move it out of the active modal
   * scope and make it unavailable again.
   */
  showPositionControls?: boolean;
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
 * Controller for PXI's floating chat surface.
 *
 * The `modal` layer is used only as an accessibility escape hatch while an
 * overlay is active. It keeps PXI above the modal mask and inside the modal's
 * interaction scope without mutating the user's normal pinned/detached setting.
 */
export function FloatingAgentChatPanel({
  layer = "content",
}: FloatingAgentChatPanelProps) {
  const fabPlacement = useAgentContext((state) => state.fabPlacement);
  const [panelSize, setPanelSize] = useState(DEFAULT_FLOATING_AGENT_CHAT_SIZE);

  return (
    <AgentChatSurface
      showPositionControls={layer !== "modal"}
      renderFrame={(children) => (
        <FloatingAgentChatFrame
          layer={layer}
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
  showPositionControls = true,
}: AgentChatSurfaceProps) {
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
      position={showPositionControls ? position : undefined}
      setPosition={showPositionControls ? setPosition : undefined}
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
  position?: ReturnType<typeof useAgentChatPanelState>["position"];
  setPosition?: ReturnType<typeof useAgentChatPanelState>["setPosition"];
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
