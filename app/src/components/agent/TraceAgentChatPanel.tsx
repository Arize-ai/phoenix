import { css } from "@emotion/react";
import { Panel, Separator } from "react-resizable-panels";

import { Flex, Icon, IconButton, Icons, Text } from "@phoenix/components";
import { compactResizeHandleCSS } from "@phoenix/components/resize/styles";
import { useFeatureFlag } from "@phoenix/contexts/FeatureFlagsContext";

import { ChatView } from "./Chat";
import { PxiGlyph } from "./PxiGlyph";
import { SessionListMenu } from "./SessionListMenu";
import {
  EMPTY_SESSION_DISPLAY_NAME,
  getSessionDisplayName,
} from "./sessionSummaryUtils";
import { useAgentChat } from "./useAgentChat";
import { useAgentChatPanelState } from "./useAgentChatPanelState";

const panelHeaderCSS = css`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--global-dimension-size-100) var(--global-dimension-size-150);
  border-bottom: 1px solid var(--global-border-color-default);
`;

const panelHeaderActionsCSS = css`
  flex-shrink: 0;
`;

const sessionHeadingCSS = css`
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex-shrink: 1;
`;

const panelContentCSS = css`
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  height: 100%;
  min-width: 0;
  overflow: hidden;
  border-left: 1px solid var(--global-border-color-default);
  background: var(--global-background-color-primary);
`;

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
    <>
      <Separator css={compactResizeHandleCSS} />
      <Panel
        id="trace-agent-chat"
        defaultSize="32%"
        minSize="24%"
        maxSize="45%"
      >
        <div css={panelContentCSS}>
          <div css={panelHeaderCSS}>
            <Flex
              direction="row"
              alignItems="center"
              gap="size-50"
              minWidth={0}
            >
              <PxiGlyph
                fill="var(--global-text-color-900)"
                css={css`
                  transform: scale(0.7);
                `}
              />
              <Text
                weight="heavy"
                css={sessionHeadingCSS}
                title={sessionDisplayName}
              >
                {sessionDisplayName}
              </Text>
            </Flex>
            <Flex
              direction="row"
              alignItems="center"
              gap="size-50"
              css={panelHeaderActionsCSS}
            >
              <SessionListMenu
                sessions={orderedSessions}
                activeSessionId={activeSessionId}
                onSelectSession={setActiveSession}
                onDeleteSession={deleteSession}
              />
              <IconButton
                size="S"
                aria-label="New chat"
                onPress={createSession}
              >
                <Icon svg={<Icons.PlusOutline />} />
              </IconButton>
              <IconButton
                size="S"
                aria-label="Close agent chat"
                onPress={closePanel}
              >
                <Icon svg={<Icons.CloseOutline />} />
              </IconButton>
            </Flex>
          </div>
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
        </div>
      </Panel>
    </>
  );
}
