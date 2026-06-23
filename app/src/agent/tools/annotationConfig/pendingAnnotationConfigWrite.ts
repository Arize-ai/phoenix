import {
  type ApprovalToolOutputSender,
  bindPendingApproval,
} from "@phoenix/agent/shared/pendingApproval";
import type { AgentStore } from "@phoenix/store/agentStore";

import { ANNOTATION_CONFIG_WRITE_REJECTED_MESSAGE } from "./constants";
import type {
  AnnotationConfigDraft,
  AnnotationConfigWriteApplyResult,
  AnnotationConfigWritePreview,
  PendingAnnotationConfigWrite,
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
  apply: (
    draft: AnnotationConfigDraft
  ) => Promise<AnnotationConfigWriteApplyResult>;
  addToolOutput: ApprovalToolOutputSender;
  agentStore: AgentStore;
}): Promise<void> {
  const { toolCallId, toolName, preview } = proposal;
  const pending = bindPendingApproval({
    pending: proposal,
    apply: () => apply(preview.draft),
    addToolOutput,
    setPending: agentStore.getState().setPendingAnnotationConfigWrite,
    rejectedMessage: ANNOTATION_CONFIG_WRITE_REJECTED_MESSAGE,
  });
  const pendingWithDraft: PendingAnnotationConfigWrite = {
    ...pending,
    acceptDraft: async (draft, { approvalSource = "user" } = {}) => {
      agentStore.getState().setPendingAnnotationConfigWrite(toolCallId, null);
      const result = await apply(draft);
      if (!result.ok) {
        await addToolOutput({
          state: "output-error",
          tool: toolName,
          toolCallId,
          errorText: result.error,
        });
        return;
      }
      await addToolOutput({
        state: "output-available",
        tool: toolName,
        toolCallId,
        output: {
          status: "accepted",
          acceptedBy: approvalSource,
          message: result.output,
        },
      });
    },
  };
  if (agentStore.getState().permissions.edits === "bypass") {
    await pending.accept?.({ approvalSource: "auto" });
    return;
  }
  agentStore
    .getState()
    .setPendingAnnotationConfigWrite(toolCallId, pendingWithDraft);
}
