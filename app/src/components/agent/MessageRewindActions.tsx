import type { Key } from "react";

import {
  Icon,
  Icons,
  Menu,
  MenuContainer,
  MenuItem,
  MenuTrigger,
} from "@phoenix/components";
import { MessageAction } from "@phoenix/components/ai/message";
import { useAgentContext } from "@phoenix/contexts/AgentContext";

import type {
  MessageRewindMode,
  MessageRewindRole,
} from "./MessageRewindDialog";

/**
 * Rewind (and, when session storage is enabled, fork) controls rendered under a
 * user or assistant message. These are uncommon, mostly-destructive actions, so
 * they are tucked behind a single "more actions" overflow button rather than
 * sitting inline next to the everyday copy/feedback controls.
 *
 * Selecting an item reports the requested action and the target message up to
 * the chat view via `onRequest`, which owns the single confirmation surface. The
 * confirmation is intentionally NOT rendered here: it is an inline panel shown
 * in place of the prompt input, because mounting a React Aria modal would flip
 * the global open-modal observer and re-parent the agent panel in a loop. The
 * overflow menu itself is a popover (not a modal overlay), so it does not trip
 * that observer.
 *
 * `showRewind` gates the rewind item. Callers set it to `false` for the last
 * assistant turn, where rewinding to that response is a no-op — there is nothing
 * after it to truncate and the chat has settled, so no pending tool calls remain
 * to clear. Fork stays available there because it branches a separate session.
 * When neither item would render, the whole control is omitted.
 */
export function MessageRewindActions({
  messageId,
  role,
  onRequest,
  showRewind = true,
}: {
  messageId: string;
  role: MessageRewindRole;
  onRequest: (request: {
    mode: MessageRewindMode;
    messageId: string;
    role: MessageRewindRole;
  }) => void;
  showRewind?: boolean;
}) {
  const canFork = useAgentContext(
    (state) => state.capabilities["session.storeSessions"]
  );

  if (!showRewind && !canFork) {
    return null;
  }

  const handleAction = (key: Key) => {
    if (key === "rewind" || key === "fork") {
      onRequest({ mode: key, messageId, role });
    }
  };

  return (
    <MenuTrigger>
      <MessageAction label="More actions">
        <Icon svg={<Icons.MoreHorizontalOutline />} />
      </MessageAction>
      <MenuContainer placement="bottom end" minHeight="auto">
        <Menu onAction={handleAction}>
          {showRewind ? (
            <MenuItem
              id="rewind"
              leadingContent={<Icon svg={<Icons.RotateCcwOutline />} />}
            >
              {role === "user"
                ? "Rewind to this message"
                : "Rewind to this response"}
            </MenuItem>
          ) : null}
          {canFork ? (
            <MenuItem
              id="fork"
              leadingContent={<Icon svg={<Icons.GitBranchOutline />} />}
            >
              Fork from this message
            </MenuItem>
          ) : null}
        </Menu>
      </MenuContainer>
    </MenuTrigger>
  );
}
