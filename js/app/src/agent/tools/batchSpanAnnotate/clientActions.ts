import type { UiOperationHandler } from "@phoenix/agent/uiOperations/types";
import type { AgentStore } from "@phoenix/store/agentStore";

import { applySpanAnnotations } from "./applySpanAnnotations";
import { bindPendingBatchSpanAnnotateOperationActions } from "./pendingBatchSpanAnnotate";
import type { BatchSpanAnnotateInput } from "./types";

/**
 * Handler for the `spans.annotate` operation: stages the batch of proposed
 * annotations and parks the calling script on the approval. Bypass edit mode
 * auto-accepts exactly like the retired standalone tool.
 */
export function createBatchSpanAnnotateClientAction({
  agentStore,
}: {
  agentStore: AgentStore;
}): UiOperationHandler<BatchSpanAnnotateInput> {
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

      if (agentStore.getState().permissions.edits === "bypass") {
        void pendingAnnotation.accept?.({ approvalSource: "auto" });
        return;
      }

      agentStore
        .getState()
        .setPendingBatchSpanAnnotate(context.callId, pendingAnnotation);
    });
}
