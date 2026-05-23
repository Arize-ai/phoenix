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
import { fadedDividerBottomCSS } from "@phoenix/components/core/layout";
import { NON_MODAL_FLOATING_Z_INDEX } from "@phoenix/components/core/zIndex";
import { compactResizeHandleCSS } from "@phoenix/components/resize/styles";
import type {
  AgentFabPlacement,
  AgentPosition,
  AgentSession,
} from "@phoenix/store/agentStore";

import { PxiGlyph } from "./PxiGlyph";
import { SessionListMenu } from "./SessionListMenu";

const panelHeaderCSS = css`
  ${fadedDividerBottomCSS}
  z-index: 3;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--global-dimension-size-100) var(--global-dimension-size-150);
  background: var(--global-background-color-default);
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
  showSessionHistory,
  position,
  onSelectSession,
  onDeleteSession,
  onCreateSession,
  onPositionChange,
  onClose,
}: {
  sessionDisplayName: string;
  orderedSessions: AgentSession[];
  activeSessionId: string | null;
  showSessionHistory: boolean;
  position?: AgentPosition;
  onSelectSession: (sessionId: string | null) => void;
  onDeleteSession: (sessionId: string) => void;
  onCreateSession: () => void;
  onPositionChange?: (position: AgentPosition) => void;
  onClose: () => void;
}) {
  const nextPosition = position === "pinned" ? "detached" : "pinned";
  const positionToggleLabel =
    position === "pinned"
      ? "Switch assistant to floating panel"
      : "Pin assistant to side";

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
        {showSessionHistory ? (
          <SessionListMenu
            sessions={orderedSessions}
            activeSessionId={activeSessionId}
            onSelectSession={onSelectSession}
            onDeleteSession={onDeleteSession}
          />
        ) : null}
        <Button
          variant="quiet"
          size="S"
          aria-label="New chat"
          onPress={onCreateSession}
          leadingVisual={<Icon svg={<Icons.PlusOutline />} />}
        />
        {position != null && onPositionChange != null ? (
          <Button
            variant="quiet"
            size="S"
            aria-label={positionToggleLabel}
            onPress={() => onPositionChange(nextPosition)}
            leadingVisual={
              <Icon
                svg={
                  position === "pinned" ? <Icons.SlideOut /> : <Icons.SlideIn />
                }
              />
            }
          />
        ) : null}
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

const floatingPanelContentCSS = css`
  position: absolute;
  z-index: ${NON_MODAL_FLOATING_Z_INDEX};
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  width: min(420px, calc(100% - 32px));
  height: min(720px, calc(100% - 32px));
  min-height: min(520px, calc(100% - 32px));
  overflow: hidden;
  border: 1px solid var(--global-border-color-default);
  border-radius: var(--global-rounding-medium);
  background: var(--global-background-color-default);
  box-shadow:
    0 12px 32px rgba(var(--global-color-gray-900-rgb), 0.2),
    0 2px 8px rgba(var(--global-color-gray-900-rgb), 0.12);

  &[data-placement^="top"] {
    top: var(--global-dimension-size-200);
  }

  &[data-placement^="bottom"] {
    bottom: var(--global-dimension-size-200);
  }

  &[data-placement$="start"] {
    left: var(--global-dimension-size-200);
  }

  &[data-placement$="end"] {
    right: var(--global-dimension-size-200);
  }

  @media (max-width: 600px), (max-height: 600px) {
    inset: var(--global-dimension-size-100);
    width: auto;
    height: auto;
    min-height: 0;
  }
`;

/**
 * Presentational shell for the floating PXI panel.
 */
export function FloatingAgentChatFrame({
  children,
  placement,
}: {
  children: ReactNode;
  placement: AgentFabPlacement;
}) {
  return (
    <div css={floatingPanelContentCSS} data-placement={placement}>
      {children}
    </div>
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
