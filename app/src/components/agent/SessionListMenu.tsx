import { useCallback, useRef, useState } from "react";

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

import { getSessionRetentionLabel } from "./sessionExpiryUtils";
import { EMPTY_SESSION_DISPLAY_NAME } from "./sessionTitleUtils";
import { TemporarySessionIcon } from "./TemporarySessionIcon";

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
  /** The session's Relay node ID, or the draft sentinel for a new chat. */
  id: string;
  title: string;
  createdAt: number;
  isTemporary?: boolean;
  isDeleteDisabled?: boolean;
  /**
   * When the workspace idle-retention rule will delete the session, in epoch
   * milliseconds. Null for temporary sessions and when idle retention is off.
   */
  expiresAt?: number | null;
  /**
   * Whether the session is beyond the workspace per-user count cap and will
   * be deleted at the next retention sweep.
   */
  isOverCountCap?: boolean;
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
              key={session.id}
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
  const displayName = session.title || EMPTY_SESSION_DISPLAY_NAME;
  const dateLabel = formatRelativeShort(session.createdAt);
  const retentionLabel = getSessionRetentionLabel({
    expiresAt: session.expiresAt ?? null,
    isOverCountCap: Boolean(session.isOverCountCap),
    now: Date.now(),
  });

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
              isDisabled={session.isDeleteDisabled}
              onPress={() => onRequestDelete(session.id)}
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
        <Flex direction="row" alignItems="center" gap="size-100">
          <Text>{displayName}</Text>
          {session.isTemporary ? <TemporarySessionIcon /> : null}
        </Flex>
        {(dateLabel || retentionLabel) && (
          <Flex direction="row" alignItems="center" gap="size-100">
            {dateLabel && (
              <Text size="XS" color="text-300">
                {dateLabel}
              </Text>
            )}
            {retentionLabel && (
              <Text size="XS" color="warning">
                {retentionLabel}
              </Text>
            )}
          </Flex>
        )}
      </Flex>
    </MenuItem>
  );
}
