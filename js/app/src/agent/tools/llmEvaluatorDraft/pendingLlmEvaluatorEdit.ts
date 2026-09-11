import { approvalOutcome } from "@phoenix/agent/shared/pendingApproval";

import { EDIT_LLM_EVALUATOR_DRAFT_NAVIGATION_CANCEL_ERROR } from "./constants";
import type {
  BindPendingLlmEvaluatorEditOptions,
  PendingLlmEvaluatorEdit,
} from "./types";

export function bindPendingLlmEvaluatorEditActions({
  pendingEdit,
  draftHost,
  emitResult,
  setPendingLlmEvaluatorEdit,
}: BindPendingLlmEvaluatorEditOptions): PendingLlmEvaluatorEdit {
  return {
    ...pendingEdit,
    accept: async ({ approvalSource = "user" } = {}) => {
      setPendingLlmEvaluatorEdit(pendingEdit.toolCallId, null);
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
              ? "LLM-evaluator draft edit auto-approved."
              : "LLM-evaluator draft edit applied.",
          ...approvalOutcome({ decision: "accepted", source: approvalSource }),
        },
      });
    },
    reject: async () => {
      setPendingLlmEvaluatorEdit(pendingEdit.toolCallId, null);
      emitResult({
        ok: true,
        output: {
          status: "rejected",
          message: "User rejected the proposed LLM-evaluator draft edit.",
          ...approvalOutcome({ decision: "rejected", source: "user" }),
        },
      });
    },
    cancel: async () => {
      setPendingLlmEvaluatorEdit(pendingEdit.toolCallId, null);
      emitResult({
        ok: false,
        error: EDIT_LLM_EVALUATOR_DRAFT_NAVIGATION_CANCEL_ERROR,
      });
    },
  };
}
