import type { ReactNode } from "react";

import { useAgentChatRuntime } from "@phoenix/contexts/AgentChatRuntimeContext";
import { useAgentContext } from "@phoenix/contexts/AgentContext";

import { ToolPartApprovalActions, ToolPartLabel } from "./ToolPartPrimitives";
import type { ToolInvocationPart } from "./toolPartTypes";

/** Answers an `approval-requested` part on the active session's chat. */
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

/** Approval card for a tool call in the `approval-requested` state. */
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
