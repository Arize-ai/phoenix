import { css } from "@emotion/react";
import { Panel, Separator } from "react-resizable-panels";

import {
  Button,
  Flex,
  Heading,
  Icon,
  IconButton,
  Icons,
} from "@phoenix/components";
import { compactResizeHandleCSS } from "@phoenix/components/resize/styles";
import { useFeatureFlag } from "@phoenix/contexts/FeatureFlagsContext";

import { Chat } from "./Chat";
import { useAgentChatPanelState } from "./useAgentChatPanelState";

const panelHeaderCSS = css`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--global-dimension-size-100) var(--global-dimension-size-150);
  border-bottom: 1px solid var(--global-border-color-default);
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
    chatApiUrl,
    menuValue,
    createSession,
    closePanel,
    handleModelChange,
  } = useAgentChatPanelState();

  if (!isAgentsEnabled || !isOpen) {
    return null;
  }

  return (
    <>
      <Separator css={compactResizeHandleCSS} />
      <Panel minSize="20%" maxSize="50%" defaultSize="30%">
        <div css={panelContentCSS}>
          <div css={panelHeaderCSS}>
            <Flex direction="row" alignItems="center" gap="size-50">
              <Icon svg={<Icons.Robot />} />
              <Heading weight="heavy">PXI</Heading>
            </Flex>
            <Flex direction="row" alignItems="center" gap="size-50">
              <Button size="S" variant="quiet" onPress={() => createSession()}>
                New chat
              </Button>
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
