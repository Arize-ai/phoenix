import { bindPendingApproval } from "@phoenix/agent/shared/pendingApproval";

import { EDIT_LLM_EVALUATOR_DRAFT_NAVIGATION_CANCEL_ERROR } from "./constants";
import type {
  BindPendingLlmEvaluatorEditOptions,
  PendingLlmEvaluatorEdit,
} from "./types";

/**
 * Attaches accept/reject/cancel callbacks to a pending LLM-evaluator draft
 * edit. The generic lifecycle lives in {@link bindPendingApproval}; the commit
 * applies the operations to the mounted draft host.
 */
export function bindPendingLlmEvaluatorEditActions({
  pendingEdit,
  draftHost,
  addToolOutput,
  clearPending,
}: BindPendingLlmEvaluatorEditOptions): PendingLlmEvaluatorEdit {
  return bindPendingApproval<PendingLlmEvaluatorEdit>({
    pending: pendingEdit,
    addToolOutput,
    clearPending,
    navigationCancelError: EDIT_LLM_EVALUATOR_DRAFT_NAVIGATION_CANCEL_ERROR,
    commit: async ({ approvalSource }) => {
      const applied = draftHost.applyOperations(pendingEdit.operations);
      if (!applied.ok) {
        return { ok: false, error: applied.error };
      }
      return {
        ok: true,
        output: {
          status: "accepted",
          acceptedBy: approvalSource,
          message:
            approvalSource === "auto"
              ? "LLM-evaluator draft edit auto-approved."
              : "LLM-evaluator draft edit applied.",
        },
      };
    },
    buildRejectedOutput: () => ({
      status: "rejected",
      message: "User rejected the proposed LLM-evaluator draft edit.",
    }),
  });
}
