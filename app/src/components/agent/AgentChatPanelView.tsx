import { css } from "@emotion/react";
import type { ReactNode } from "react";
import { Panel, Separator } from "react-resizable-panels";

import { Flex, Icon, IconButton, Icons, Text } from "@phoenix/components";
import { compactResizeHandleCSS } from "@phoenix/components/resize/styles";
import type { AgentSession } from "@phoenix/store/agentStore";

import { PxiGlyph } from "./PxiGlyph";
import { SessionListMenu } from "./SessionListMenu";

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
  min-width: 420px;
  overflow: hidden;
  border-top: 1px solid var(--global-border-color-default);
`;

/**
 * Presentational shell for the resizable agent panel.
 *
 * All request lifecycle and persistence behavior lives outside this component
 * so the panel can be hidden without tearing down the active chat.
 */
export function AgentChatPanelView({
  sessionDisplayName,
  orderedSessions,
  activeSessionId,
  onSelectSession,
  onDeleteSession,
  onCreateSession,
  onClose,
  children,
}: {
  sessionDisplayName: string;
  orderedSessions: AgentSession[];
  activeSessionId: string | null;
  onSelectSession: (sessionId: string | null) => void;
  onDeleteSession: (sessionId: string) => void;
  onCreateSession: () => void;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <>
      <Separator css={compactResizeHandleCSS} />
      <Panel
        id="agent-chat"
        minSize="420px"
        maxSize="50%"
        defaultSize="420px"
        groupResizeBehavior="preserve-pixel-size"
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
                onSelectSession={onSelectSession}
                onDeleteSession={onDeleteSession}
              />
              <IconButton
                size="S"
                aria-label="New chat"
                onPress={onCreateSession}
              >
                <Icon svg={<Icons.PlusOutline />} />
              </IconButton>
              <IconButton
                size="S"
                aria-label="Close agent chat"
                onPress={onClose}
              >
                <Icon svg={<Icons.CloseOutline />} />
              </IconButton>
            </Flex>
          </div>
          {children}
        </div>
      </Panel>
    </>
  );
}
