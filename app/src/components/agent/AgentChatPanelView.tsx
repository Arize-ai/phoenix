import { css } from "@emotion/react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
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
import { compactResizeHandleCSS } from "@phoenix/components/resize/styles";
import { useActiveModalPortalContainerElement } from "@phoenix/hooks/useHasOpenModal";
import type {
  AgentFabPlacement,
  AgentPosition,
  AgentSession,
} from "@phoenix/store/agentStore";
import type { Size } from "@phoenix/types/geometry";

import { PxiGlyph } from "./PxiGlyph";
import { ResizableFloatingPanel } from "./ResizableFloatingPanel";
import { SessionListMenu } from "./SessionListMenu";

const PANEL_HEADER_Z_INDEX = 3;
const FLOATING_PANEL_WIDTH_PX = 420;
const FLOATING_PANEL_HEIGHT_PX = 720;
const FLOATING_PANEL_MIN_WIDTH_PX = 360;
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
  background: var(--global-background-color-default);
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
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  height: 100%;
  min-width: 420px;
  overflow: hidden;
  border-top: 1px solid var(--global-border-color-default);
`;

/**
 * Shared header for assistant chat surfaces.
 */
export function AgentChatHeader({
  sessionDisplayName,
  orderedSessions,
  activeSessionId,
  showSessionHistory,
  preferredPosition,
  onSelectSession,
  onDeleteSession,
  onCreateSession,
  onPreferredPositionChange,
  isForcedFloatingMode = false,
  onClose,
}: {
  sessionDisplayName: string;
  orderedSessions: AgentSession[];
  activeSessionId: string | null;
  showSessionHistory: boolean;
  preferredPosition?: AgentPosition;
  onSelectSession: (sessionId: string | null) => void;
  onDeleteSession: (sessionId: string) => void;
  onCreateSession: () => void;
  onPreferredPositionChange?: (position: AgentPosition) => void;
  isForcedFloatingMode?: boolean;
  onClose: () => void;
}) {
  const nextPreferredPosition =
    preferredPosition === "pinned" ? "detached" : "pinned";
  const positionToggleLabel =
    preferredPosition === "pinned"
      ? "Switch assistant to floating panel"
      : "Pin assistant to side";
  const isPositionToggleDisabled =
    isForcedFloatingMode || onPreferredPositionChange == null;

  return (
    <div className="agent-chat-panel__header" css={panelHeaderCSS}>
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
        <LinkButton
          variant="quiet"
          size="S"
          to="/settings/agents"
          aria-label="Agent settings"
          leadingVisual={<Icon svg={<Icons.OptionsOutline />} />}
        />
        {preferredPosition != null ? (
          <Button
            variant="quiet"
            size="S"
            aria-label={positionToggleLabel}
            isDisabled={isPositionToggleDisabled}
            disabledReason={
              isForcedFloatingMode
                ? "Unavailable due to open panel"
                : undefined
            }
            disabledReasonPlacement="bottom"
            disabledReasonOffset={8}
            onPress={() =>
              onPreferredPositionChange?.(nextPreferredPosition)
            }
            leadingVisual={
              <Icon
                svg={
                  preferredPosition === "pinned" ? (
                    <Icons.CollapseOutline />
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
          aria-label="Close agent chat"
          onPress={onClose}
          leadingVisual={<Icon svg={<Icons.CloseOutline />} />}
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

/**
 * Presentational shell for the floating assistant panel.
 */
export function FloatingAgentChatFrame({
  children,
  floatingAction,
  layer = "content",
  placement,
  size = DEFAULT_FLOATING_AGENT_CHAT_SIZE,
  onSizeChange,
}: {
  children: ReactNode;
  floatingAction?: ReactNode;
  layer?: "content" | "modal";
  placement: AgentFabPlacement;
  size?: Size;
  onSizeChange?: (size: Size) => void;
}) {
  const activeModalPortalContainer = useActiveModalPortalContainerElement();
  const panel = (
    <ResizableFloatingPanel
      floatingAction={floatingAction}
      layer={layer}
      minSize={MIN_FLOATING_AGENT_CHAT_SIZE}
      placement={placement}
      size={size}
      onSizeChange={onSizeChange}
    >
      {children}
    </ResizableFloatingPanel>
  );

  if (layer !== "modal") {
    return panel;
  }

  return createPortal(panel, activeModalPortalContainer ?? document.body);
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
