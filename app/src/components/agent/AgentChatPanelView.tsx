import { css } from "@emotion/react";
import type { ReactNode } from "react";
import { Panel, Separator } from "react-resizable-panels";

import {
  Button,
  Flex,
  Icon,
  Icons,
  LinkButton,
  Text,
} from "@phoenix/components";
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
 * Shared header for PXI chat surfaces.
 */
export function AgentChatHeader({
  sessionDisplayName,
  orderedSessions,
  activeSessionId,
  onSelectSession,
  onDeleteSession,
  onCreateSession,
  onClose,
}: {
  sessionDisplayName: string;
  orderedSessions: AgentSession[];
  activeSessionId: string | null;
  onSelectSession: (sessionId: string | null) => void;
  onDeleteSession: (sessionId: string) => void;
  onCreateSession: () => void;
  onClose: () => void;
}) {
  return (
    <div css={panelHeaderCSS}>
      <Flex direction="row" alignItems="center" gap="size-50" minWidth={0}>
        <PxiGlyph
          fill="var(--global-text-color-900)"
          css={css`
            transform: scale(0.7);
          `}
        />
        <Text weight="heavy" css={sessionHeadingCSS} title={sessionDisplayName}>
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
        <Button
          variant="quiet"
          size="S"
          aria-label="New chat"
          onPress={onCreateSession}
          leadingVisual={<Icon svg={<Icons.PlusOutline />} />}
        />
        <LinkButton
          variant="quiet"
          size="S"
          to="/settings/agents"
          aria-label="Agent settings"
          leadingVisual={<Icon svg={<Icons.OptionsOutline />} />}
        />
        <Button
          variant="quiet"
          size="S"
          aria-label="Close agent chat"
          onPress={onClose}
          leadingVisual={<Icon svg={<Icons.CloseOutline />} />}
        />
      </Flex>
    </div>
  );
}

/**
 * Shared content frame for the docked and embedded PXI surfaces.
 */
function AgentChatFrame({
  panelId,
  panelProps,
  children,
  contentCss,
}: {
  panelId: string;
  panelProps?: Partial<React.ComponentProps<typeof Panel>>;
  children: ReactNode;
  contentCss: ReturnType<typeof css>;
}) {
  return (
    <>
      <Separator css={compactResizeHandleCSS} />
      <Panel {...panelProps} id={panelId}>
        <div css={contentCss}>{children}</div>
      </Panel>
    </>
  );
}

/**
 * Presentational shell for the docked resizable agent panel.
 */
export function DockedAgentChatFrame({ children }: { children: ReactNode }) {
  return (
    <AgentChatFrame
      panelId="agent-chat"
      panelProps={{
        minSize: "420px",
        maxSize: "50%",
        defaultSize: "420px",
        groupResizeBehavior: "preserve-pixel-size",
      }}
      contentCss={panelContentCSS}
    >
      {children}
    </AgentChatFrame>
  );
}

const tracePanelContentCSS = css`
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  height: 100%;
  min-width: 0;
  overflow: hidden;
  border-left: 1px solid var(--global-border-color-default);
  background: var(--global-background-color-primary);
`;

/**
 * Presentational shell for the trace slideover's embedded PXI panel.
 */
export function TraceAgentChatFrame({ children }: { children: ReactNode }) {
  return (
    <AgentChatFrame
      panelId="trace-agent-chat"
      panelProps={{
        defaultSize: "32%",
        minSize: "24%",
        maxSize: "45%",
      }}
      contentCss={tracePanelContentCSS}
    >
      {children}
    </AgentChatFrame>
  );
}
