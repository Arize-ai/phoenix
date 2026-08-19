import type { ReactNode } from "react";

import { useAgentChatRuntime } from "@phoenix/contexts/AgentChatRuntimeContext";
import { useAgentContext } from "@phoenix/contexts/AgentContext";

import { ToolPartApprovalActions, ToolPartLabel } from "./ToolPartPrimitives";
import type { ToolInvocationPart } from "./toolPartTypes";

/**
 * Resolves a server-deferred tool call's approval on the active session's chat:
 * an approved call re-executes server-side, a denied one returns a generic
 * denial to the model. This is the single place tool detail components go
 * through to answer an `approval-requested` part — they stay presentational and
 * never touch the chat runtime directly.
 *
 * `canRespond` reports whether a chat is actually reachable. Callers must
 * disable their controls when it is false: the answer cannot be delivered, and
 * accepting the click silently drops the user's decision.
 */
export function useRespondToToolApproval(): {
  respondToApproval: (args: { approvalId: string; approved: boolean }) => void;
  canRespond: boolean;
} {
  const activeSessionId = useAgentContext((state) => state.activeSessionId);
  const chatRuntime = useAgentChatRuntime();
  const chat = activeSessionId ? chatRuntime.getChat(activeSessionId) : null;
  return {
    canRespond: chat !== null,
    respondToApproval: ({ approvalId, approved }) => {
      if (!chat) {
        // Unreachable while the controls honour `canRespond`; kept so a future
        // caller that forgets cannot deliver an approval to nothing.
        return;
      }
      void chat.addToolApprovalResponse({
        id: approvalId,
        approved,
      });
    },
  };
}

export const UNREACHABLE_CHAT_MESSAGE =
  "This conversation is no longer connected, so the tool call can't be " +
  "answered from here. Reload the conversation to respond.";

/**
 * Approval card for a tool call in the `approval-requested` state: a warning
 * label, an optional tool-specific body describing what will execute, and the
 * Accept/Reject actions that resume the deferred call. Renders nothing for
 * any other state, so detail components can include it unconditionally.
 */
export function ToolApprovalRequest({
  part,
  label = "Approval required",
  children,
}: {
  part: ToolInvocationPart;
  label?: string;
  /** Tool-specific preview of what the user is approving. */
  children?: ReactNode;
}) {
  const { respondToApproval, canRespond } = useRespondToToolApproval();
  if (part.state !== "approval-requested") {
    return null;
  }
  const approvalId = part.approval.id;
  return (
    <>
      <ToolPartLabel variant="warning">{label}</ToolPartLabel>
      {children}
      <ToolPartApprovalActions
        isDisabled={!canRespond}
        staleMessage={UNREACHABLE_CHAT_MESSAGE}
        onAccept={() => respondToApproval({ approvalId, approved: true })}
        onReject={() => respondToApproval({ approvalId, approved: false })}
      />
    </>
  );
}
