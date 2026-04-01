import { css } from "@emotion/react";
import { Panel, Separator } from "react-resizable-panels";

import { Flex, Icon, IconButton, Icons, Text } from "@phoenix/components";
import { compactResizeHandleCSS } from "@phoenix/components/resize/styles";
import { useFeatureFlag } from "@phoenix/contexts/FeatureFlagsContext";

import { Chat } from "./Chat";
import { SessionListMenu } from "./SessionListMenu";
import {
  EMPTY_SESSION_DISPLAY_NAME,
  getSessionDisplayName,
} from "./sessionSummaryUtils";
import { useAgentChatPanelState } from "./useAgentChatPanelState";

const panelHeaderCSS = css`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--global-dimension-size-100) var(--global-dimension-size-150);
  border-bottom: 1px solid var(--global-border-color-default);
  container-type: inline-size;
`;

const panelHeaderActionsCSS = css`
  // prevent the actions from giving up their space to the heading
  flex-shrink: 0;
`;

const sessionHeadingCSS = css`
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  // prevent the session heading from pushing actions off screen
  flex-shrink: 1;
`;

const panelContentCSS = css`
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  height: 100%;
  overflow: hidden;
  border-top: 1px solid var(--global-border-color-default);
`;

/**
 * Resizable side panel that hosts the PXI agent chat.
 *
 * Renders inside the main {@link Layout} within a `react-resizable-panels`
 * Group. Returns `null` when the `agents` feature flag is off or the panel
 * is closed, so it adds zero overhead to the default layout.
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

  if (!isAgentsEnabled || !isOpen) {
    return null;
  }

  return (
    <>
      <Separator css={compactResizeHandleCSS} />
      <Panel minSize="20%" maxSize="50%" defaultSize="30%">
        <div css={panelContentCSS}>
          <div css={panelHeaderCSS}>
            <Flex
              direction="row"
              alignItems="center"
              gap="size-50"
              minWidth={0}
            >
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
                onPress={() => createSession()}
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
          <Chat
            key={`${activeSessionId}-${chatApiUrl}`}
            sessionId={activeSessionId}
            chatApiUrl={chatApiUrl}
            modelMenuValue={menuValue}
            onModelChange={handleModelChange}
          />
        </div>
      </Panel>
    </>
  );
}
