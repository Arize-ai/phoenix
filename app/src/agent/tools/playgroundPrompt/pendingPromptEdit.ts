import {
  EDIT_PROMPT_NAVIGATION_CANCEL_ERROR,
  EDIT_PROMPT_TOOL_NAME,
} from "./constants";
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
    accept: async () => {
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
        setPendingPromptEdit(pendingEdit.toolCallId, null);
        return;
      }
      if (current.output.revision !== pendingEdit.expectedRevision) {
        await addToolOutput({
          state: "output-error",
          tool: EDIT_PROMPT_TOOL_NAME,
          toolCallId: pendingEdit.toolCallId,
          errorText:
            "The prompt changed after this edit was proposed. Call read_prompt again before proposing another edit.",
        });
        setPendingPromptEdit(pendingEdit.toolCallId, null);
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
      await addToolOutput({
        state: "output-available",
        tool: EDIT_PROMPT_TOOL_NAME,
        toolCallId: pendingEdit.toolCallId,
        output: {
          status: "accepted",
          instanceId: pendingEdit.instanceId,
          revision: afterApply.ok
            ? afterApply.output.revision
            : pendingEdit.after.revision,
          message: "Prompt edit applied.",
        },
      });
      setPendingPromptEdit(pendingEdit.toolCallId, null);
    },
    reject: async () => {
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
      setPendingPromptEdit(pendingEdit.toolCallId, null);
    },
    cancel: async () => {
      await addToolOutput({
        state: "output-error",
        tool: EDIT_PROMPT_TOOL_NAME,
        toolCallId: pendingEdit.toolCallId,
        errorText: EDIT_PROMPT_NAVIGATION_CANCEL_ERROR,
      });
      setPendingPromptEdit(pendingEdit.toolCallId, null);
    },
  };
}
