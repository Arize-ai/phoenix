import { isOperationCallApprovalGranted } from "@phoenix/agent/uiOperations/scriptApprovalGrant";
import type { UIOperationHandler } from "@phoenix/agent/uiOperations/types";
import type { AgentStore } from "@phoenix/store/agentStore";

import { applySpanAnnotations } from "./applySpanAnnotations";
import { bindPendingBatchSpanAnnotateOperationActions } from "./pendingBatchSpanAnnotate";
import type { BatchSpanAnnotateInput } from "./types";

/**
 * Handler for the `spans.annotate` operation: stages the batch of proposed
 * annotations. Applies immediately in bypass edit mode or when the run holds
 * a script-level approval grant; otherwise stages the Accept/Reject card.
 */
export function createBatchSpanAnnotateClientAction({
  agentStore,
}: {
  agentStore: AgentStore;
}): UIOperationHandler<BatchSpanAnnotateInput> {
  return (input, context) =>
    new Promise((resolve) => {
      const pendingAnnotation = bindPendingBatchSpanAnnotateOperationActions({
        pendingAnnotation: {
          toolCallId: context.callId,
          sessionId: context.sessionId ?? "",
          annotations: input,
        },
        applyAnnotations: applySpanAnnotations,
        emitResult: resolve,
        setPendingBatchSpanAnnotate:
          agentStore.getState().setPendingBatchSpanAnnotate,
      });

      if (
        agentStore.getState().permissions.edits === "bypass" ||
        isOperationCallApprovalGranted(context.callId)
      ) {
        void pendingAnnotation.accept?.({ approvalSource: "auto" });
        return;
      }

      agentStore
        .getState()
        .setPendingBatchSpanAnnotate(context.callId, pendingAnnotation);
    });
}
