import {
  WRITE_PROMPT_TOOLS_NAVIGATION_CANCEL_ERROR,
  WRITE_PROMPT_TOOLS_TOOL_NAME,
} from "./constants";
import { applyWritePromptTools } from "./promptToolsStore";
import type {
  BindPendingPromptToolWriteOptions,
  PendingPromptToolWrite,
} from "./types";

/**
 * Attaches accept/reject/cancel callbacks to a pending tool-write batch using
 * the live AI SDK tool-call context that created the proposal. Mirrors
 * `bindPendingPromptEditActions`: the batch is re-applied on accept (which
 * re-checks the revision against the current store), so a tool list that
 * drifted between propose and accept is rejected with the stale error.
 */
export function bindPendingPromptToolWriteActions({
  pendingWrite,
  playgroundStore,
  addToolOutput,
  setPendingPromptToolWrite,
}: BindPendingPromptToolWriteOptions): PendingPromptToolWrite {
  return {
    ...pendingWrite,
    accept: async ({ approvalSource = "user" } = {}) => {
      setPendingPromptToolWrite(pendingWrite.toolCallId, null);
      const currentInstance = playgroundStore
        .getState()
        .instances.find((instance) => instance.id === pendingWrite.instanceId);
      if (
        currentInstance != null &&
        currentInstance.model.provider !== pendingWrite.provider
      ) {
        await addToolOutput({
          state: "output-error",
          tool: WRITE_PROMPT_TOOLS_TOOL_NAME,
          toolCallId: pendingWrite.toolCallId,
          errorText:
            "The playground provider changed since PXI proposed these prompt tool changes. Ask PXI to re-read the prompt tools and propose the change again.",
        });
        return;
      }
      const result = applyWritePromptTools({
        playgroundStore,
        input: pendingWrite.input,
      });
      if (!result.ok) {
        await addToolOutput({
          state: "output-error",
          tool: WRITE_PROMPT_TOOLS_TOOL_NAME,
          toolCallId: pendingWrite.toolCallId,
          errorText: result.error,
        });
        return;
      }
      await addToolOutput({
        state: "output-available",
        tool: WRITE_PROMPT_TOOLS_TOOL_NAME,
        toolCallId: pendingWrite.toolCallId,
        output: {
          status: "accepted",
          acceptedBy: approvalSource,
          instanceId: pendingWrite.instanceId,
          ...result.output,
          message:
            approvalSource === "auto"
              ? "Prompt tool changes auto-approved."
              : "Prompt tool changes applied.",
        },
      });
    },
    reject: async () => {
      setPendingPromptToolWrite(pendingWrite.toolCallId, null);
      await addToolOutput({
        state: "output-available",
        tool: WRITE_PROMPT_TOOLS_TOOL_NAME,
        toolCallId: pendingWrite.toolCallId,
        output: {
          status: "rejected",
          instanceId: pendingWrite.instanceId,
          message: "User rejected the proposed prompt tool changes.",
        },
      });
    },
    cancel: async () => {
      setPendingPromptToolWrite(pendingWrite.toolCallId, null);
      await addToolOutput({
        state: "output-error",
        tool: WRITE_PROMPT_TOOLS_TOOL_NAME,
        toolCallId: pendingWrite.toolCallId,
        errorText: WRITE_PROMPT_TOOLS_NAVIGATION_CANCEL_ERROR,
      });
    },
  };
}
