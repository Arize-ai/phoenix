import { css } from "@emotion/react";
import { useCallback, useMemo, useState } from "react";

import {
  Button,
  Icon,
  Icons,
  Menu,
  MenuContainer,
  MenuFooter,
  MenuHeaderTitle,
  MenuItem,
  MenuTrigger,
  Text,
  Tooltip,
  TooltipTrigger,
} from "@phoenix/components";
import type { AgentSession } from "@phoenix/store/agentStore";
import { formatRelativeDate } from "@phoenix/utils/timeFormatUtils";

import { DeleteSessionDialog } from "./DeleteSessionDialog";
import {
  EMPTY_SESSION_DISPLAY_NAME,
  getSessionDisplayName,
} from "./sessionSummaryUtils";

/**
 * Minimum container width (in px) at which the active session summary is
 * displayed inline next to the sessions icon button. Below this threshold
 * only the icon is visible.
 */
const SHOW_SUMMARY_BREAKPOINT = "500px";

const sessionTriggerCSS = css`
  /* Allow the button to shrink so the label can truncate */
  min-width: 0;
`;

const sessionTriggerLabelCSS = css`
  display: none;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: var(--global-font-size-s);
  color: var(--global-text-color-700);

  @container (min-width: ${SHOW_SUMMARY_BREAKPOINT}) {
    display: block;
  }
`;

const sessionItemCSS = css`
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  flex: 1;
`;

const sessionDateCSS = css`
  font-size: var(--global-font-size-xs);
  color: var(--global-text-color-700);
`;

const deleteButtonCSS = css`
  opacity: 0;
  transition: opacity 0.15s;
  flex-shrink: 0;

  .react-aria-MenuItem[data-hovered] &,
  .react-aria-MenuItem[data-focused] & {
    opacity: 1;
  }
`;

/**
 * Props for the session list menu.
 *
 * @param sessions - full session objects, displayed in the order provided
 * @param activeSessionId - ID of the currently active session (for highlight)
 * @param onSelectSession - called when the user clicks a session to switch to
 * @param onDeleteSession - called after the user confirms session deletion
 */
export type SessionListMenuProps = {
  sessions: AgentSession[];
  activeSessionId: string | null;
  onSelectSession: (sessionId: string) => void;
  onDeleteSession: (sessionId: string) => void;
};

export function SessionListMenu({
  sessions,
  activeSessionId,
  onSelectSession,
  onDeleteSession,
}: SessionListMenuProps) {
  const [pendingDeleteSession, setPendingDeleteSession] =
    useState<AgentSession | null>(null);

  const activeSessionSummary = useMemo(() => {
    if (!activeSessionId) return "";
    const active = sessions.find((s) => s.id === activeSessionId);
    return active ? getSessionDisplayName(active) : "";
  }, [activeSessionId, sessions]);

  const handleAction = useCallback(
    (key: React.Key) => {
      onSelectSession(String(key));
    },
    [onSelectSession]
  );

  const handleConfirmDelete = useCallback(() => {
    if (pendingDeleteSession) {
      onDeleteSession(pendingDeleteSession.id);
      setPendingDeleteSession(null);
    }
  }, [pendingDeleteSession, onDeleteSession]);

  const selectedKeys = activeSessionId ? [activeSessionId] : [];

  return (
    <>
      <MenuTrigger>
        <Button
          size="S"
          variant="quiet"
          aria-label="Sessions"
          css={sessionTriggerCSS}
        >
          {activeSessionSummary &&
            activeSessionSummary !== EMPTY_SESSION_DISPLAY_NAME && (
              <span css={sessionTriggerLabelCSS}>{activeSessionSummary}</span>
            )}
          <Icon svg={<Icons.ClockOutline />} />
        </Button>
        <MenuContainer placement="bottom start" maxHeight={400}>
          <MenuHeaderTitle>Sessions</MenuHeaderTitle>
          <Menu
            selectionMode="single"
            selectedKeys={selectedKeys}
            onAction={handleAction}
          >
            {sessions.map((session) => (
              <SessionMenuItem
                key={session.id}
                session={session}
                onRequestDelete={setPendingDeleteSession}
              />
            ))}
          </Menu>
          {sessions.length === 0 && (
            <MenuFooter>
              <Text color="text-700" size="S">
                No sessions yet
              </Text>
            </MenuFooter>
          )}
        </MenuContainer>
      </MenuTrigger>
      <DeleteSessionDialog
        isOpen={pendingDeleteSession !== null}
        onOpenChange={(isOpen: boolean) => {
          if (!isOpen) setPendingDeleteSession(null);
        }}
        onConfirmDelete={handleConfirmDelete}
        sessionSummary={
          pendingDeleteSession
            ? getSessionDisplayName(pendingDeleteSession)
            : ""
        }
      />
    </>
  );
}

function SessionMenuItem({
  session,
  onRequestDelete,
}: {
  session: AgentSession;
  onRequestDelete: (session: AgentSession) => void;
}) {
  const displayName = getSessionDisplayName(session);
  const dateLabel = formatRelativeDate(session.createdAt);

  return (
    <MenuItem
      id={session.id}
      textValue={displayName}
      trailingContent={
        <div
          css={deleteButtonCSS}
          role="presentation"
          onPointerDown={(event) => {
            // Prevent the menu from selecting this item when clicking delete
            event.stopPropagation();
          }}
          onClick={(event) => {
            event.stopPropagation();
          }}
        >
          <TooltipTrigger delay={300}>
            <Button
              size="S"
              variant="quiet"
              aria-label={`Delete session: ${displayName}`}
              onPress={() => onRequestDelete(session)}
            >
              <Icon svg={<Icons.CloseOutline />} />
            </Button>
            <Tooltip>Delete</Tooltip>
          </TooltipTrigger>
        </div>
      }
    >
      <div css={sessionItemCSS}>
        <Text>{displayName}</Text>
        {dateLabel && <span css={sessionDateCSS}>{dateLabel}</span>}
      </div>
    </MenuItem>
  );
}
