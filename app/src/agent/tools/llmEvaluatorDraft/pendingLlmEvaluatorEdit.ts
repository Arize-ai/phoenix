import {
  EDIT_LLM_EVALUATOR_DRAFT_NAVIGATION_CANCEL_ERROR,
  EDIT_LLM_EVALUATOR_DRAFT_TOOL_NAME,
} from "./constants";
import type {
  BindPendingLlmEvaluatorEditOptions,
  PendingLlmEvaluatorEdit,
} from "./types";

export function bindPendingLlmEvaluatorEditActions({
  pendingEdit,
  draftHost,
  addToolOutput,
  setPendingLlmEvaluatorEdit,
}: BindPendingLlmEvaluatorEditOptions): PendingLlmEvaluatorEdit {
  return {
    ...pendingEdit,
    accept: async ({ approvalSource = "user" } = {}) => {
      setPendingLlmEvaluatorEdit(pendingEdit.toolCallId, null);
      const applied = draftHost.applyOperations(pendingEdit.operations);
      if (!applied.ok) {
        await addToolOutput({
          state: "output-error",
          tool: EDIT_LLM_EVALUATOR_DRAFT_TOOL_NAME,
          toolCallId: pendingEdit.toolCallId,
          errorText: applied.error,
        });
        return;
      }
      await addToolOutput({
        state: "output-available",
        tool: EDIT_LLM_EVALUATOR_DRAFT_TOOL_NAME,
        toolCallId: pendingEdit.toolCallId,
        output: {
          status: "accepted",
          acceptedBy: approvalSource,
          message:
            approvalSource === "auto"
              ? "LLM-evaluator draft edit auto-approved."
              : "LLM-evaluator draft edit applied.",
        },
      });
    },
    reject: async () => {
      setPendingLlmEvaluatorEdit(pendingEdit.toolCallId, null);
      await addToolOutput({
        state: "output-available",
        tool: EDIT_LLM_EVALUATOR_DRAFT_TOOL_NAME,
        toolCallId: pendingEdit.toolCallId,
        output: {
          status: "rejected",
          message: "User rejected the proposed LLM-evaluator draft edit.",
        },
      });
    },
    cancel: async () => {
      setPendingLlmEvaluatorEdit(pendingEdit.toolCallId, null);
      await addToolOutput({
        state: "output-error",
        tool: EDIT_LLM_EVALUATOR_DRAFT_TOOL_NAME,
        toolCallId: pendingEdit.toolCallId,
        errorText: EDIT_LLM_EVALUATOR_DRAFT_NAVIGATION_CANCEL_ERROR,
      });
    },
  };
}
