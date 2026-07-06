import {
  EDIT_CODE_EVALUATOR_DRAFT_NAVIGATION_CANCEL_ERROR,
  EDIT_CODE_EVALUATOR_DRAFT_TOOL_NAME,
} from "./constants";
import type {
  BindPendingCodeEvaluatorEditOptions,
  PendingCodeEvaluatorEdit,
} from "./types";

export function bindPendingCodeEvaluatorEditActions({
  pendingEdit,
  draftHost,
  addToolOutput,
  setPendingCodeEvaluatorEdit,
}: BindPendingCodeEvaluatorEditOptions): PendingCodeEvaluatorEdit {
  return {
    ...pendingEdit,
    accept: async ({ approvalSource = "user" } = {}) => {
      setPendingCodeEvaluatorEdit(pendingEdit.toolCallId, null);
      const applied = draftHost.applyOperations(pendingEdit.operations);
      if (!applied.ok) {
        await addToolOutput({
          state: "output-error",
          tool: EDIT_CODE_EVALUATOR_DRAFT_TOOL_NAME,
          toolCallId: pendingEdit.toolCallId,
          errorText: applied.error,
        });
        return;
      }
      await addToolOutput({
        state: "output-available",
        tool: EDIT_CODE_EVALUATOR_DRAFT_TOOL_NAME,
        toolCallId: pendingEdit.toolCallId,
        output: {
          status: "accepted",
          acceptedBy: approvalSource,
          message:
            approvalSource === "auto"
              ? "Code-evaluator draft edit auto-approved."
              : "Code-evaluator draft edit applied.",
        },
      });
    },
    reject: async () => {
      setPendingCodeEvaluatorEdit(pendingEdit.toolCallId, null);
      await addToolOutput({
        state: "output-available",
        tool: EDIT_CODE_EVALUATOR_DRAFT_TOOL_NAME,
        toolCallId: pendingEdit.toolCallId,
        output: {
          status: "rejected",
          message: "User rejected the proposed code-evaluator draft edit.",
        },
      });
    },
    cancel: async () => {
      setPendingCodeEvaluatorEdit(pendingEdit.toolCallId, null);
      await addToolOutput({
        state: "output-error",
        tool: EDIT_CODE_EVALUATOR_DRAFT_TOOL_NAME,
        toolCallId: pendingEdit.toolCallId,
        errorText: EDIT_CODE_EVALUATOR_DRAFT_NAVIGATION_CANCEL_ERROR,
      });
    },
  };
}
