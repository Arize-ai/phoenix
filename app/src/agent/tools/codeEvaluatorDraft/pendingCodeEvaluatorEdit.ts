import {
  EDIT_CODE_EVALUATOR_DRAFT_NAVIGATION_CANCEL_ERROR,
  EDIT_CODE_EVALUATOR_DRAFT_TOOL_NAME,
} from "./constants";
import type {
  BindPendingCodeEvaluatorEditOptions,
  PendingCodeEvaluatorEdit,
} from "./types";

/** Attaches accept/reject/cancel callbacks to a pending code-evaluator edit. */
export function bindPendingCodeEvaluatorEditActions({
  pendingEdit,
  draftHost,
  addToolOutput,
  setPendingCodeEvaluatorEdit,
}: BindPendingCodeEvaluatorEditOptions): PendingCodeEvaluatorEdit {
  return {
    ...pendingEdit,
    accept: async () => {
      setPendingCodeEvaluatorEdit(pendingEdit.toolCallId, null);
      const current = draftHost.getSnapshot();
      if (current.revision !== pendingEdit.expectedRevision) {
        await addToolOutput({
          state: "output-error",
          tool: EDIT_CODE_EVALUATOR_DRAFT_TOOL_NAME,
          toolCallId: pendingEdit.toolCallId,
          errorText:
            "The code-evaluator draft changed after this edit was proposed, so it can no longer be applied.",
        });
        return;
      }
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
          revision: applied.output.revision,
          message: "Code-evaluator draft edit applied.",
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
