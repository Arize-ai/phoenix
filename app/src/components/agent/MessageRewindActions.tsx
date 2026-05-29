import { Icon, Icons } from "@phoenix/components";
import { MessageAction } from "@phoenix/components/ai/message";
import { useAgentContext } from "@phoenix/contexts/AgentContext";

import type {
  MessageRewindMode,
  MessageRewindRole,
} from "./MessageRewindDialog";

/**
 * Rewind (and, when session storage is enabled, fork) controls rendered under a
 * user or assistant message. Renders bare {@link MessageAction} buttons so
 * callers can place them inside an existing `MessageActions` row.
 *
 * Pressing a control reports the requested action and the target message up to
 * the chat view via `onRequest`, which owns the single confirmation dialog. The
 * dialog is intentionally NOT rendered here: mounting a React Aria modal inside
 * the scroll-managed message list triggers a remount loop with the
 * stick-to-bottom observers, so the overlay must live outside the list.
 */
export function MessageRewindActions({
  messageId,
  role,
  onRequest,
}: {
  messageId: string;
  role: MessageRewindRole;
  onRequest: (request: {
    mode: MessageRewindMode;
    messageId: string;
    role: MessageRewindRole;
  }) => void;
}) {
  const canFork = useAgentContext(
    (state) => state.capabilities["session.storeSessions"]
  );

  return (
    <>
      <MessageAction
        label="Rewind to this message"
        tooltip={
          role === "user"
            ? "Undo the chat to this message and restore it to the input"
            : "Undo the chat back to this response"
        }
        onPress={() => onRequest({ mode: "rewind", messageId, role })}
      >
        <Icon svg={<Icons.RotateCcwOutline />} />
      </MessageAction>
      {canFork ? (
        <MessageAction
          label="Fork from this message"
          tooltip="Start a new chat from this message"
          onPress={() => onRequest({ mode: "fork", messageId, role })}
        >
          <Icon svg={<Icons.GitBranchOutline />} />
        </MessageAction>
      ) : null}
    </>
  );
}
