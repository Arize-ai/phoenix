import { css } from "@emotion/react";
import type { ReactNode, RefObject } from "react";
import { Pressable } from "react-aria";
import { Panel, Separator } from "react-resizable-panels";

import {
  Badge,
  Button,
  Flex,
  Icon,
  Icons,
  LinkButton,
  RichTooltip,
  Text,
  TooltipArrow,
  TooltipTrigger,
} from "@phoenix/components";
import { fadedDividerBottomCSS } from "@phoenix/components/core/layout";
import { compactResizeHandleCSS } from "@phoenix/components/resize/styles";
import type {
  AgentFabPlacement,
  AgentPosition,
  AgentSession,
} from "@phoenix/store/agentStore";
import type { Size } from "@phoenix/types/geometry";

import { PxiAnimatedGlyph } from "./PxiAnimatedGlyph";
import { ResizableFloatingPanel } from "./ResizableFloatingPanel";
import { SessionListMenu } from "./SessionListMenu";
import { EMPTY_SESSION_DISPLAY_NAME } from "./sessionSummaryUtils";

const PANEL_HEADER_Z_INDEX = 3;
const FLOATING_PANEL_WIDTH_PX = 520;
const FLOATING_PANEL_HEIGHT_PX = 720;
const FLOATING_PANEL_MIN_WIDTH_PX = 480;
const FLOATING_PANEL_MIN_HEIGHT_PX = 520;

export const DEFAULT_FLOATING_AGENT_CHAT_SIZE: Size = {
  width: FLOATING_PANEL_WIDTH_PX,
  height: FLOATING_PANEL_HEIGHT_PX,
};

const MIN_FLOATING_AGENT_CHAT_SIZE: Size = {
  width: FLOATING_PANEL_MIN_WIDTH_PX,
  height: FLOATING_PANEL_MIN_HEIGHT_PX,
};

const panelHeaderCSS = css`
  ${fadedDividerBottomCSS}
  box-sizing: border-box;
  flex: none;
  z-index: ${PANEL_HEADER_Z_INDEX};
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  column-gap: var(--global-dimension-size-100);
  min-height: var(--global-dimension-size-600);
  padding: var(--global-dimension-size-100) var(--global-dimension-size-150);
  /* Inherit the panel surface so the header blends with whichever frame hosts
     it: the darker docked panel or the lighter floating panel. */
  background: transparent;
`;

const panelHeaderActionsCSS = css`
  justify-self: end;
  min-width: max-content;
`;

const sessionHeadingCSS = css`
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex-shrink: 1;
`;

const panelContentCSS = css`
  --agent-chat-panel-background-color: var(--global-background-color-default);
  --prompt-input-background-color: var(--agent-chat-panel-background-color);

  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  height: 100%;
  min-width: 420px;
  overflow: hidden;
  border-top: 1px solid var(--global-border-color-default);
  /* The docked panel is a sibling of the content frame, not a child, so it
     would otherwise inherit the lighter body background. Pin it to the same
     surface token the content frame uses so the chat panel reads as one
     continuous surface with the main content area. */
  background: var(--agent-chat-panel-background-color);
`;

/**
 * Shared header for assistant chat surfaces.
 */
export function AgentChatHeader({
  sessionDisplayName,
  orderedSessions,
  activeSessionId,
  showSessionHistory,
  position,
  isPositionChangeDisabled = false,
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
  isPositionChangeDisabled?: boolean;
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
  // Only surface the beta badge on the empty/new session, where there is no
  // summary yet competing for space in the header.
  const showBetaBadge = sessionDisplayName === EMPTY_SESSION_DISPLAY_NAME;

  return (
    <div className="agent-chat-panel__header" css={panelHeaderCSS}>
      <Flex direction="row" alignItems="center" gap="size-50" minWidth={0}>
        <PxiAnimatedGlyph isIconSized />
        <Text weight="heavy" css={sessionHeadingCSS} title={sessionDisplayName}>
          {sessionDisplayName}
        </Text>
        {showBetaBadge ? (
          <TooltipTrigger delay={0}>
            <Pressable>
              <span
                role="button"
                tabIndex={0}
                css={css`
                  display: inline-flex;
                  flex: none;
                  cursor: default;
                `}
              >
                <Badge variant="info">Beta</Badge>
              </span>
            </Pressable>
            <RichTooltip>
              <TooltipArrow />
              <Text size="XS">
                The assistant is in beta — expect changes as it evolves.
              </Text>
            </RichTooltip>
          </TooltipTrigger>
        ) : null}
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
          leadingVisual={<Icon svg={<Icons.Plus />} />}
        />
        <LinkButton
          variant="quiet"
          size="S"
          to="/settings/agents"
          aria-label="Assistant settings"
          leadingVisual={<Icon svg={<Icons.Options />} />}
        />
        {position != null && onPositionChange != null ? (
          <Button
            variant="quiet"
            size="S"
            aria-label={positionToggleLabel}
            isDisabled={isPositionChangeDisabled}
            onPress={() => {
              if (isPositionChangeDisabled) {
                return;
              }
              onPositionChange(nextPosition);
            }}
            leadingVisual={
              <Icon
                svg={
                  position === "pinned" ? (
                    <Icons.Collapse />
                  ) : (
                    <Icons.SidebarAttachRight />
                  )
                }
              />
            }
          />
        ) : null}
        <Button
          variant="quiet"
          size="S"
          aria-label="Close assistant"
          onPress={onClose}
          leadingVisual={<Icon svg={<Icons.Close />} />}
        />
      </Flex>
    </div>
  );
}

/**
 * Shared content frame for the docked and embedded assistant surfaces.
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
      <Panel
        {...panelProps}
        id={panelId}
        aria-label={panelId === "agent-chat" ? "Assistant" : undefined}
        data-agent-rail={panelId === "agent-chat" ? "" : undefined}
        data-testid={panelId === "agent-chat" ? "assistant-rail" : undefined}
        role={panelId === "agent-chat" ? "complementary" : undefined}
      >
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

/**
 * Presentational shell for the floating assistant panel.
 */
export function FloatingAgentChatFrame({
  boundaryRef,
  children,
  placement,
  size = DEFAULT_FLOATING_AGENT_CHAT_SIZE,
  onSizeChange,
}: {
  boundaryRef?: RefObject<HTMLElement | null>;
  children: ReactNode;
  placement: AgentFabPlacement;
  size?: Size;
  onSizeChange?: (size: Size) => void;
}) {
  return (
    <ResizableFloatingPanel
      boundaryRef={boundaryRef}
      minSize={MIN_FLOATING_AGENT_CHAT_SIZE}
      placement={placement}
      size={size}
      onSizeChange={onSizeChange}
    >
      {children}
    </ResizableFloatingPanel>
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
 * Presentational shell for the trace slideover's embedded assistant panel.
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
