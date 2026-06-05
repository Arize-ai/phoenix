import {
  REMOVE_PROMPT_INSTANCE_NAVIGATION_CANCEL_ERROR,
  REMOVE_PROMPT_INSTANCE_TOOL_NAME,
} from "./constants";
import { removePromptInstance } from "./promptStore";
import type {
  BindPendingPromptInstanceRemovalOptions,
  PendingPromptInstanceRemoval,
} from "./types";

export function bindPendingPromptInstanceRemovalActions({
  pendingRemoval,
  playgroundStore,
  addToolOutput,
  setPendingPromptInstanceRemoval,
}: BindPendingPromptInstanceRemovalOptions): PendingPromptInstanceRemoval {
  return {
    ...pendingRemoval,
    accept: async ({ approvalSource = "user" } = {}) => {
      setPendingPromptInstanceRemoval(pendingRemoval.toolCallId, null);
      const result = removePromptInstance({
        playgroundStore,
        instanceId: pendingRemoval.instanceId,
      });
      if (!result.ok) {
        await addToolOutput({
          state: "output-error",
          tool: REMOVE_PROMPT_INSTANCE_TOOL_NAME,
          toolCallId: pendingRemoval.toolCallId,
          errorText: result.error,
        });
        return;
      }
      await addToolOutput({
        state: "output-available",
        tool: REMOVE_PROMPT_INSTANCE_TOOL_NAME,
        toolCallId: pendingRemoval.toolCallId,
        output: {
          ...result.output,
          acceptedBy: approvalSource,
          message:
            approvalSource === "auto"
              ? "Prompt instance removal auto-approved."
              : "Prompt instance removed.",
        },
      });
    },
    reject: async () => {
      setPendingPromptInstanceRemoval(pendingRemoval.toolCallId, null);
      await addToolOutput({
        state: "output-available",
        tool: REMOVE_PROMPT_INSTANCE_TOOL_NAME,
        toolCallId: pendingRemoval.toolCallId,
        output: {
          status: "rejected",
          instanceId: pendingRemoval.instanceId,
          label: pendingRemoval.label,
          message: "User rejected the prompt instance removal.",
        },
      });
    },
    cancel: async () => {
      setPendingPromptInstanceRemoval(pendingRemoval.toolCallId, null);
      await addToolOutput({
        state: "output-error",
        tool: REMOVE_PROMPT_INSTANCE_TOOL_NAME,
        toolCallId: pendingRemoval.toolCallId,
        errorText: REMOVE_PROMPT_INSTANCE_NAVIGATION_CANCEL_ERROR,
      });
    },
  };
}
