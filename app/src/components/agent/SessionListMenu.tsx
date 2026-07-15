import { useCallback, useRef, useState } from "react";

import type { AgentUIMessage } from "@phoenix/agent/chat/types";
import {
  Button,
  Flex,
  Icon,
  Icons,
  Keyboard,
  Menu,
  MenuContainer,
  MenuItem,
  MenuTrigger,
  Text,
  Tooltip,
  TooltipTrigger,
} from "@phoenix/components";
import { CompactEmptyState } from "@phoenix/components/core/empty";
import { StopPropagation } from "@phoenix/components/StopPropagation";
import { formatRelativeShort } from "@phoenix/utils/timeFormatUtils";

import { getSessionDisplayName } from "./sessionTitleUtils";

/**
 * Props for the session list menu.
 *
 * @param sessions - full session objects, displayed in the order provided
 * @param activeSessionId - ID of the currently active session (for highlight)
 * @param onSelectSession - called when the user clicks a session to switch to
 * @param onDeleteSession - called after the user confirms session deletion
 */
export type SessionListMenuProps = {
  sessions: AgentSessionListItem[];
  activeSessionId: string | null;
  onSelectSession: (sessionId: string) => void;
  onDeleteSession: (sessionId: string) => void;
  hasNextPage?: boolean;
  isLoadingNextPage?: boolean;
  onLoadNextPage?: () => void;
};

export type AgentSessionListItem = {
  clientKey: string;
  id: string | null;
  title: string;
  messages: AgentUIMessage[];
  createdAt: number;
  isDeleteDisabled?: boolean;
};

export function SessionListMenu({
  sessions,
  activeSessionId,
  onSelectSession,
  onDeleteSession,
  hasNextPage = false,
  isLoadingNextPage = false,
  onLoadNextPage,
}: SessionListMenuProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  // Track which session is currently focused in the menu for keyboard shortcuts
  const focusedSessionRef = useRef<AgentSessionListItem | null>(null);

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
        focusedSessionRef.current &&
        !focusedSessionRef.current.isDeleteDisabled
      ) {
        e.preventDefault();
        e.stopPropagation();
        handleDeleteSession(focusedSessionRef.current.clientKey);
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
        leadingVisual={<Icon svg={<Icons.History />} />}
      />
      <MenuContainer placement="bottom end" minHeight="auto" maxHeight={400}>
        <Menu
          selectionMode="single"
          selectedKeys={selectedKeys}
          onAction={handleAction}
          onKeyDown={handleMenuKeyDown}
          onScroll={(event) => {
            const { scrollHeight, scrollTop, clientHeight } =
              event.currentTarget;
            if (
              scrollHeight - scrollTop - clientHeight < 300 &&
              hasNextPage &&
              !isLoadingNextPage
            ) {
              onLoadNextPage?.();
            }
          }}
        >
          {sessions.map((session) => (
            <SessionMenuItem
              key={session.clientKey}
              session={session}
              focusedSessionRef={focusedSessionRef}
              onRequestDelete={handleDeleteSession}
            />
          ))}
        </Menu>
        {sessions.length === 0 && (
          <CompactEmptyState
            icon={<Icon svg={<Icons.History />} />}
            description="No sessions yet"
          />
        )}
      </MenuContainer>
    </MenuTrigger>
  );
}

function SessionMenuItem({
  session,
  focusedSessionRef,
  onRequestDelete,
}: {
  session: AgentSessionListItem;
  focusedSessionRef: React.RefObject<AgentSessionListItem | null>;
  onRequestDelete: (sessionId: string) => void;
}) {
  const displayName = getSessionDisplayName(session);
  const dateLabel = formatRelativeShort(session.createdAt);

  const handleFocusChange = useCallback(
    (isFocused: boolean) => {
      if (isFocused) {
        focusedSessionRef.current = session;
      } else if (focusedSessionRef.current?.clientKey === session.clientKey) {
        focusedSessionRef.current = null;
      }
    },
    [session, focusedSessionRef]
  );

  return (
    <MenuItem
      id={session.clientKey}
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
              isDisabled={session.isDeleteDisabled}
              onPress={() => onRequestDelete(session.clientKey)}
              leadingVisual={<Icon svg={<Icons.Trash />} />}
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
