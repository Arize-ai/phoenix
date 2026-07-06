import { bindPendingApproval } from "@phoenix/agent/shared/pendingApproval";

import { EDIT_CODE_EVALUATOR_DRAFT_NAVIGATION_CANCEL_ERROR } from "./constants";
import type {
  BindPendingCodeEvaluatorEditOptions,
  PendingCodeEvaluatorEdit,
} from "./types";

/**
 * Attaches accept/reject/cancel callbacks to a pending code-evaluator draft
 * edit. The generic lifecycle lives in {@link bindPendingApproval}; the commit
 * applies the operations to the mounted draft host.
 */
export function bindPendingCodeEvaluatorEditActions({
  pendingEdit,
  draftHost,
  addToolOutput,
  clearPending,
}: BindPendingCodeEvaluatorEditOptions): PendingCodeEvaluatorEdit {
  return bindPendingApproval<PendingCodeEvaluatorEdit>({
    pending: pendingEdit,
    addToolOutput,
    clearPending,
    navigationCancelError: EDIT_CODE_EVALUATOR_DRAFT_NAVIGATION_CANCEL_ERROR,
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
              ? "Code-evaluator draft edit auto-approved."
              : "Code-evaluator draft edit applied.",
        },
      };
    },
    buildRejectedOutput: () => ({
      status: "rejected",
      message: "User rejected the proposed code-evaluator draft edit.",
    }),
  });
}
