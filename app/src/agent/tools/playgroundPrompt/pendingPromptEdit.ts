import {
  EDIT_PROMPT_NAVIGATION_CANCEL_ERROR,
  EDIT_PROMPT_TOOL_NAME,
} from "./constants";
import { computePromptEditSummary } from "./diffSummary";
import { applyPromptOperations, getPromptSnapshot } from "./promptStore";
import type { BindPendingPromptEditOptions, PendingPromptEdit } from "./types";

/**
 * Attaches accept/reject callbacks to a pending prompt edit using the live
 * AI SDK tool-call context that created the proposal.
 */
export function bindPendingPromptEditActions({
  pendingEdit,
  playgroundStore,
  addToolOutput,
  setPendingPromptEdit,
}: BindPendingPromptEditOptions): PendingPromptEdit {
  return {
    ...pendingEdit,
    accept: async ({ approvalSource = "user" } = {}) => {
      setPendingPromptEdit(pendingEdit.toolCallId, null);
      const current = getPromptSnapshot({
        playgroundStore,
        instanceId: pendingEdit.instanceId,
      });
      if (!current.ok) {
        await addToolOutput({
          state: "output-error",
          tool: EDIT_PROMPT_TOOL_NAME,
          toolCallId: pendingEdit.toolCallId,
          errorText: current.error,
        });
        return;
      }
      if (current.output.revision !== pendingEdit.expectedRevision) {
        await addToolOutput({
          state: "output-error",
          tool: EDIT_PROMPT_TOOL_NAME,
          toolCallId: pendingEdit.toolCallId,
          errorText:
            "The prompt was changed after this edit was proposed, so it can no longer be applied.",
        });
        return;
      }
      applyPromptOperations({
        playgroundStore,
        instanceId: pendingEdit.instanceId,
        operations: pendingEdit.operations,
      });
      const afterApply = getPromptSnapshot({
        playgroundStore,
        instanceId: pendingEdit.instanceId,
      });
      const summary = computePromptEditSummary(
        pendingEdit.before,
        afterApply.ok ? afterApply.output : pendingEdit.after
      );
      await addToolOutput({
        state: "output-available",
        tool: EDIT_PROMPT_TOOL_NAME,
        toolCallId: pendingEdit.toolCallId,
        output: {
          status: "accepted",
          acceptedBy: approvalSource,
          instanceId: pendingEdit.instanceId,
          revision: afterApply.ok
            ? afterApply.output.revision
            : pendingEdit.after.revision,
          summary,
          message:
            approvalSource === "auto"
              ? "Prompt edit auto-approved."
              : "Prompt edit applied.",
        },
      });
    },
    reject: async () => {
      setPendingPromptEdit(pendingEdit.toolCallId, null);
      await addToolOutput({
        state: "output-available",
        tool: EDIT_PROMPT_TOOL_NAME,
        toolCallId: pendingEdit.toolCallId,
        output: {
          status: "rejected",
          instanceId: pendingEdit.instanceId,
          message: "User rejected the proposed prompt edit.",
        },
      });
    },
    cancel: async () => {
      setPendingPromptEdit(pendingEdit.toolCallId, null);
      await addToolOutput({
        state: "output-error",
        tool: EDIT_PROMPT_TOOL_NAME,
        toolCallId: pendingEdit.toolCallId,
        errorText: EDIT_PROMPT_NAVIGATION_CANCEL_ERROR,
      });
    },
  };
}
