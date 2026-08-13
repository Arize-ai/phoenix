import type { ReactNode } from "react";

import { useAgentChatRuntime } from "@phoenix/contexts/AgentChatRuntimeContext";
import { useAgentContext } from "@phoenix/contexts/AgentContext";

import { ToolPartApprovalActions, ToolPartLabel } from "./ToolPartPrimitives";
import type { ToolInvocationPart } from "./toolPartTypes";

/**
 * Returns a callback that resolves a server-deferred tool call's approval on
 * the active session's chat: an approved call re-executes server-side, a
 * denied one returns the `reason` to the model. This is the single place tool
 * detail components go through to answer an `approval-requested` part —
 * they stay presentational and never touch the chat runtime directly.
 */
export function useRespondToToolApproval() {
  const activeSessionId = useAgentContext((state) => state.activeSessionId);
  const chatRuntime = useAgentChatRuntime();
  return ({
    approvalId,
    approved,
    reason,
  }: {
    approvalId: string;
    approved: boolean;
    reason?: string;
  }) => {
    if (!activeSessionId) {
      return;
    }
    const chat = chatRuntime.getChat(activeSessionId);
    if (!chat) {
      return;
    }
    void chat.addToolApprovalResponse({
      id: approvalId,
      approved,
      ...(reason ? { reason } : null),
    });
  };
}

/**
 * Approval card for a tool call in the `approval-requested` state: a warning
 * label, an optional tool-specific body describing what will execute, and the
 * Accept/Reject actions that resume the deferred call. Renders nothing for
 * any other state, so detail components can include it unconditionally.
 */
export function ToolApprovalRequest({
  part,
  label = "Approval required",
  denialReason = "The user denied the tool call.",
  children,
}: {
  part: ToolInvocationPart;
  label?: string;
  /** Sent to the model as the approval response's reason on Reject. */
  denialReason?: string;
  /** Tool-specific preview of what the user is approving. */
  children?: ReactNode;
}) {
  const respondToApproval = useRespondToToolApproval();
  if (part.state !== "approval-requested") {
    return null;
  }
  const approvalId = part.approval.id;
  return (
    <>
      <ToolPartLabel variant="warning">{label}</ToolPartLabel>
      {children}
      <ToolPartApprovalActions
        onAccept={() => respondToApproval({ approvalId, approved: true })}
        onReject={() =>
          respondToApproval({
            approvalId,
            approved: false,
            reason: denialReason,
          })
        }
      />
    </>
  );
}
