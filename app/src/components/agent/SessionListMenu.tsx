import { useCallback, useRef, useState } from "react";

import {
  Button,
  Flex,
  Icon,
  Icons,
  Keyboard,
  Menu,
  MenuContainer,
  MenuEmpty,
  MenuItem,
  MenuTrigger,
  Text,
  Tooltip,
  TooltipTrigger,
} from "@phoenix/components";
import { StopPropagation } from "@phoenix/components/StopPropagation";
import type { AgentSession } from "@phoenix/store/agentStore";
import { formatRelativeShort } from "@phoenix/utils/timeFormatUtils";

import { getSessionDisplayName } from "./sessionSummaryUtils";

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
  const [menuOpen, setMenuOpen] = useState(false);

  // Track which session is currently focused in the menu for keyboard shortcuts
  const focusedSessionRef = useRef<AgentSession | null>(null);

  const handleAction = useCallback(
    (key: React.Key) => {
      onSelectSession(String(key));
    },
    [onSelectSession]
  );

  const handleDeleteSession = useCallback(
    (sessionId: string) => {
      onDeleteSession(sessionId);
      setMenuOpen(false);
    },
    [onDeleteSession]
  );

  const handleMenuKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (
        (e.key === "Delete" || e.key === "Backspace") &&
        focusedSessionRef.current
      ) {
        e.preventDefault();
        e.stopPropagation();
        handleDeleteSession(focusedSessionRef.current.id);
      }
    },
    [handleDeleteSession]
  );

  const selectedKeys = activeSessionId ? [activeSessionId] : [];

  return (
    <MenuTrigger onOpenChange={setMenuOpen} isOpen={menuOpen}>
      <Button
        variant="quiet"
        size="S"
        aria-label="Sessions"
        leadingVisual={<Icon svg={<Icons.HistoryOutline />} />}
      />
      <MenuContainer placement="bottom end" maxHeight={400}>
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
              onRequestDelete={handleDeleteSession}
            />
          ))}
        </Menu>
        {sessions.length === 0 && <MenuEmpty>No sessions yet</MenuEmpty>}
      </MenuContainer>
    </MenuTrigger>
  );
}

function SessionMenuItem({
  session,
  focusedSessionRef,
  onRequestDelete,
}: {
  session: AgentSession;
  focusedSessionRef: React.RefObject<AgentSession | null>;
  onRequestDelete: (sessionId: string) => void;
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
              variant="quiet"
              size="S"
              aria-label={`Delete session: ${displayName}`}
              onPress={() => onRequestDelete(session.id)}
              leadingVisual={<Icon svg={<Icons.TrashOutline />} />}
            />
            <Tooltip>
              Delete <Keyboard>⌫</Keyboard>
            </Tooltip>
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
