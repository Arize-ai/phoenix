import {
  type ApprovalToolOutputSender,
  bindPendingApproval,
} from "@phoenix/agent/shared/pendingApproval";
import type { AgentStore } from "@phoenix/store/agentStore";

import { ANNOTATE_WRITE_REJECTED_MESSAGE } from "./constants";
import type { AnnotateApplyResult, AnnotatePreview } from "./types";

/**
 * Stage an approval-gated annotation write: bind the pending write, then either
 * apply immediately (bypass edit mode) or park it for the inline Accept/Reject
 * card (manual mode).
 */
export async function stageAnnotate({
  pending: proposal,
  apply,
  addToolOutput,
  agentStore,
}: {
  pending: {
    toolCallId: string;
    toolName: string;
    preview: AnnotatePreview;
  };
  apply: () => Promise<AnnotateApplyResult>;
  addToolOutput: ApprovalToolOutputSender;
  agentStore: AgentStore;
}): Promise<void> {
  const pending = bindPendingApproval({
    pending: proposal,
    apply,
    addToolOutput,
    setPending: agentStore.getState().setPendingAnnotate,
    rejectedMessage: ANNOTATE_WRITE_REJECTED_MESSAGE,
  });
  if (agentStore.getState().permissions.edits === "bypass") {
    await pending.accept?.({ approvalSource: "auto" });
    return;
  }
  agentStore.getState().setPendingAnnotate(proposal.toolCallId, pending);
}
