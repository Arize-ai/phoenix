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
import { AgentChatWidgetButton } from "./AgentChatWidget";
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
  /**
   * Whether this surface is being shown in a temporary forced-floating mode
   * instead of reflecting the user's saved layout preference.
   */
  isForcedFloatingMode?: boolean;
};

type AgentChatSurfaceProps = {
  renderFrame: (
    children: ReactNode,
    options: { floatingAction?: ReactNode }
  ) => ReactNode;
  /**
   * Whether this surface is temporarily being forced into floating mode.
   *
   * Forced-floating panels intentionally keep this control visible but
   * disabled because the current surface is being driven by another overlay,
   * not by the user's saved layout preference.
   */
  isForcedFloatingMode?: boolean;
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
  layer = "content",
  isForcedFloatingMode = layer === "modal",
}: FloatingAgentChatPanelProps) {
  const fabPlacement = useAgentContext((state) => state.fabPlacement);
  const [panelSize, setPanelSize] = useState(DEFAULT_FLOATING_AGENT_CHAT_SIZE);

  return (
    <AgentChatSurface
      isForcedFloatingMode={isForcedFloatingMode}
      renderFrame={(children, { floatingAction }) => (
        <FloatingAgentChatFrame
          floatingAction={floatingAction}
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
  isForcedFloatingMode = false,
}: AgentChatSurfaceProps) {
  const isAgentsEnabled = useFeatureFlag("agents");
  const {
    isOpen,
    position: preferredPosition,
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
      preferredPosition={preferredPosition}
      setPreferredPosition={setPosition}
      isForcedFloatingMode={isForcedFloatingMode}
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
  preferredPosition,
  setPreferredPosition,
  isForcedFloatingMode,
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
  preferredPosition?: ReturnType<typeof useAgentChatPanelState>["position"];
  setPreferredPosition?: ReturnType<typeof useAgentChatPanelState>["setPosition"];
  isForcedFloatingMode?: boolean;
  handleModelChange: ReturnType<
    typeof useAgentChatPanelState
  >["handleModelChange"];
  renderFrame: (
    children: ReactNode,
    options: { floatingAction?: ReactNode }
  ) => ReactNode;
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

  const showFloatingCloseAction =
    preferredPosition === "detached" || isForcedFloatingMode;

  return renderFrame(
    <>
      <AgentChatHeader
        sessionDisplayName={sessionDisplayName}
        orderedSessions={orderedSessions}
        activeSessionId={activeSessionId}
        showSessionHistory={showSessionHistory}
        preferredPosition={preferredPosition}
        onSelectSession={setActiveSession}
        onDeleteSession={deleteSession}
        onCreateSession={createSession}
        onPreferredPositionChange={setPreferredPosition}
        isForcedFloatingMode={isForcedFloatingMode}
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
    </>,
    {
      floatingAction: showFloatingCloseAction ? (
        <AgentChatWidgetButton
          ariaLabel="Close assistant"
          onPress={closePanel}
        />
      ) : undefined,
    }
  );
}
