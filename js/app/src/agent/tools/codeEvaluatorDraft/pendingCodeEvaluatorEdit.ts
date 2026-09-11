import { approvalOutcome } from "@phoenix/agent/shared/pendingApproval";

import { EDIT_CODE_EVALUATOR_DRAFT_NAVIGATION_CANCEL_ERROR } from "./constants";
import type {
  BindPendingCodeEvaluatorEditOptions,
  PendingCodeEvaluatorEdit,
} from "./types";

export function bindPendingCodeEvaluatorEditActions({
  pendingEdit,
  draftHost,
  emitResult,
  setPendingCodeEvaluatorEdit,
}: BindPendingCodeEvaluatorEditOptions): PendingCodeEvaluatorEdit {
  return {
    ...pendingEdit,
    accept: async ({ approvalSource = "user" } = {}) => {
      setPendingCodeEvaluatorEdit(pendingEdit.toolCallId, null);
      const applied = draftHost.applyOperations(pendingEdit.operations);
      if (!applied.ok) {
        emitResult({ ok: false, error: applied.error });
        return;
      }
      emitResult({
        ok: true,
        output: {
          status: "accepted",
          acceptedBy: approvalSource,
          message:
            approvalSource === "auto"
              ? "Code-evaluator draft edit auto-approved."
              : "Code-evaluator draft edit applied.",
          ...approvalOutcome({ decision: "accepted", source: approvalSource }),
        },
      });
    },
    reject: async () => {
      setPendingCodeEvaluatorEdit(pendingEdit.toolCallId, null);
      emitResult({
        ok: true,
        output: {
          status: "rejected",
          message: "User rejected the proposed code-evaluator draft edit.",
          ...approvalOutcome({ decision: "rejected", source: "user" }),
        },
      });
    },
    cancel: async () => {
      setPendingCodeEvaluatorEdit(pendingEdit.toolCallId, null);
      emitResult({
        ok: false,
        error: EDIT_CODE_EVALUATOR_DRAFT_NAVIGATION_CANCEL_ERROR,
      });
    },
  };
}
