import {
  type ApprovalToolOutputSender,
  bindPendingApproval,
} from "@phoenix/agent/shared/pendingApproval";
import type { AgentStore } from "@phoenix/store/agentStore";

import { ANNOTATION_CONFIG_WRITE_REJECTED_MESSAGE } from "./constants";
import type {
  AnnotationConfigWriteApplyResult,
  AnnotationConfigWritePreview,
} from "./types";

/**
 * Stage an approval-gated annotation-config write: bind the pending write via the
 * generic {@link bindPendingApproval}, then either apply immediately (bypass edit
 * mode) or park it for the inline Accept/Reject card (manual mode). Mirrors
 * `stageDatasetWrite` for the annotation-config domain.
 */
export async function stageAnnotationConfigWrite({
  pending: proposal,
  apply,
  addToolOutput,
  agentStore,
}: {
  pending: {
    toolCallId: string;
    toolName: string;
    preview: AnnotationConfigWritePreview;
  };
  apply: () => Promise<AnnotationConfigWriteApplyResult>;
  addToolOutput: ApprovalToolOutputSender;
  agentStore: AgentStore;
}): Promise<void> {
  const pending = bindPendingApproval({
    pending: proposal,
    apply,
    addToolOutput,
    setPending: agentStore.getState().setPendingAnnotationConfigWrite,
    rejectedMessage: ANNOTATION_CONFIG_WRITE_REJECTED_MESSAGE,
  });
  if (agentStore.getState().permissions.edits === "bypass") {
    await pending.accept?.({ approvalSource: "auto" });
    return;
  }
  agentStore
    .getState()
    .setPendingAnnotationConfigWrite(proposal.toolCallId, pending);
}
