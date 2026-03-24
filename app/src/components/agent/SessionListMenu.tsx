import { css } from "@emotion/react";
import { useCallback, useMemo, useRef, useState } from "react";

import {
  Button,
  Flex,
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
import { StopPropagation } from "@phoenix/components/StopPropagation";
import type { AgentSession } from "@phoenix/store/agentStore";
import { formatRelativeShort } from "@phoenix/utils/timeFormatUtils";

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
  // useful to close the menu programmatically when deleting a session
  const [menuOpen, setMenuOpen] = useState(false);
  const [pendingDeleteSession, _setPendingDeleteSession] =
    useState<AgentSession | null>(null);

  // Track which session is currently focused in the menu for keyboard shortcuts
  const focusedSessionRef = useRef<AgentSession | null>(null);

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

  const setPendingDeleteSession = useCallback(
    (session: AgentSession | null) => {
      _setPendingDeleteSession(session);
      if (session) {
        setMenuOpen(false);
      }
    },
    [setMenuOpen]
  );

  const handleConfirmDelete = useCallback(() => {
    if (pendingDeleteSession) {
      onDeleteSession(pendingDeleteSession.id);
      setPendingDeleteSession(null);
    }
  }, [pendingDeleteSession, onDeleteSession, setPendingDeleteSession]);

  const handleMenuKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (
        (e.key === "Delete" || e.key === "Backspace") &&
        focusedSessionRef.current
      ) {
        e.preventDefault();
        e.stopPropagation();
        setPendingDeleteSession(focusedSessionRef.current);
      }
    },
    [setPendingDeleteSession]
  );

  const selectedKeys = activeSessionId ? [activeSessionId] : [];

  const hasSessionSummary =
    activeSessionSummary && activeSessionSummary !== EMPTY_SESSION_DISPLAY_NAME;

  return (
    <>
      <MenuTrigger onOpenChange={setMenuOpen} isOpen={menuOpen}>
        <Button
          size="S"
          variant="quiet"
          aria-label="Sessions"
          css={sessionTriggerCSS}
          trailingVisual={<Icon svg={<Icons.ClockOutline />} />}
        >
          {hasSessionSummary ? (
            <span css={sessionTriggerLabelCSS}>{activeSessionSummary}</span>
          ) : (
            // hack to prevent button from layout-shifting when children are added/removed
            <>{""}</>
          )}
        </Button>
        <MenuContainer placement="bottom start" maxHeight={400}>
          <MenuHeaderTitle>Sessions</MenuHeaderTitle>
          <Menu
            selectionMode="single"
            selectedKeys={selectedKeys}
            onAction={handleAction}
            onKeyDown={handleMenuKeyDown}
          >
            {sessions.map((session) => (
              <SessionMenuItem
                key={session.id}
                session={session}
                focusedSessionRef={focusedSessionRef}
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
  focusedSessionRef,
  onRequestDelete,
}: {
  session: AgentSession;
  focusedSessionRef: React.RefObject<AgentSession | null>;
  onRequestDelete: (session: AgentSession) => void;
}) {
  const displayName = getSessionDisplayName(session);
  const dateLabel = formatRelativeShort(session.createdAt);

  const handleFocusChange = useCallback(
    (isFocused: boolean) => {
      if (isFocused) {
        focusedSessionRef.current = session;
      } else if (focusedSessionRef.current?.id === session.id) {
        focusedSessionRef.current = null;
      }
    },
    [session, focusedSessionRef]
  );

  return (
    <MenuItem
      id={session.id}
      textValue={`${displayName}\n${dateLabel}`}
      onFocusChange={handleFocusChange}
      aria-keyshortcuts="Delete"
      trailingContent={
        <StopPropagation>
          <TooltipTrigger delay={300}>
            <Button
              size="S"
              variant="quiet"
              aria-label={`Delete session: ${displayName}`}
              onPress={() => onRequestDelete(session)}
              css={deleteButtonCSS}
            >
              <Icon svg={<Icons.TrashOutline />} />
            </Button>
            <Tooltip>Delete (Del)</Tooltip>
          </TooltipTrigger>
        </StopPropagation>
      }
    >
      <Flex direction="column" gap="size-50">
        <Text>{displayName}</Text>
        {dateLabel && (
          <Text size="XS" color="text-300">
            {dateLabel}
          </Text>
        )}
      </Flex>
    </MenuItem>
  );
}
