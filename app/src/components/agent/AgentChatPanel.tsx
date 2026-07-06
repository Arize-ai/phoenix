import { Suspense, useState, type ReactNode, type RefObject } from "react";

import { ChatSessionUsage } from "@phoenix/components/agent/ChatSessionUsage";
import { Loading } from "@phoenix/components/core";
import { useAgentContext } from "@phoenix/contexts/AgentContext";
import type { AgentPosition } from "@phoenix/store/agentStore";

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

type AgentChatPanelLayer = "content" | "modal";

type FloatingAgentChatPanelProps = {
  /**
   * Optional element that scopes the panel's default position and clamping.
   * When omitted, the panel falls back to the visual viewport.
   */
  boundaryRef?: RefObject<HTMLElement | null>;
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
  /**
   * Whether an active overlay is temporarily forcing the assistant into the
   * floating layout regardless of the user's saved panel preference.
   */
  isForcedFloating?: boolean;
};

type AgentChatSurfaceProps = {
  renderFrame: (children: ReactNode) => ReactNode;
  /**
   * Visible panel position to show in the header when the rendered surface is
   * temporarily different from the user's saved preference.
   */
  positionOverride?: AgentPosition;
  /**
   * Whether the header position toggle should be disabled because the visible
   * layout is controlled by another surface, such as a modal or drawer.
   */
  isPositionChangeDisabled?: boolean;
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
 *
 * The `modal` layer is used only as an accessibility escape hatch while an
 * overlay is active. It keeps the assistant above the modal mask and inside the
 * modal's interaction scope without mutating the user's normal pinned/detached
 * setting.
 */
export function FloatingAgentChatPanel({
  boundaryRef,
  layer = "content",
  isForcedFloating = false,
}: FloatingAgentChatPanelProps) {
  const fabPlacement = useAgentContext((state) => state.fabPlacement);
  const [panelSize, setPanelSize] = useState(DEFAULT_FLOATING_AGENT_CHAT_SIZE);

  return (
    <AgentChatSurface
      isPositionChangeDisabled={isForcedFloating}
      positionOverride={isForcedFloating ? "detached" : undefined}
      renderFrame={(children) => (
        <FloatingAgentChatFrame
          boundaryRef={boundaryRef}
          layer={layer}
          placement={fabPlacement}
          size={panelSize}
          onSizeChange={setPanelSize}
          isForcedFloating={isForcedFloating}
        >
          {children}
        </FloatingAgentChatFrame>
      )}
    />
  );
}

function AgentChatSurface({
  renderFrame,
  positionOverride,
  isPositionChangeDisabled = false,
}: AgentChatSurfaceProps) {
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
      position={positionOverride ?? position}
      setPosition={setPosition}
      isPositionChangeDisabled={isPositionChangeDisabled}
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
