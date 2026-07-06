import { bindPendingApproval } from "@phoenix/agent/shared/pendingApproval";

import { WRITE_PROMPT_TOOLS_NAVIGATION_CANCEL_ERROR } from "./constants";
import { applyWritePromptTools } from "./promptToolsStore";
import type {
  BindPendingPromptToolWriteOptions,
  PendingPromptToolWrite,
} from "./types";

/**
 * Attaches accept/reject/cancel callbacks to a pending tool-write batch. The
 * generic lifecycle lives in {@link bindPendingApproval}; the commit is
 * write-specific: it re-checks the provider hasn't drifted since the diff was
 * proposed, then re-applies the batch (which re-checks the revision).
 */
export function bindPendingPromptToolWriteActions({
  pendingWrite,
  playgroundStore,
  addToolOutput,
  clearPending,
}: BindPendingPromptToolWriteOptions): PendingPromptToolWrite {
  return bindPendingApproval<PendingPromptToolWrite>({
    pending: pendingWrite,
    addToolOutput,
    clearPending,
    navigationCancelError: WRITE_PROMPT_TOOLS_NAVIGATION_CANCEL_ERROR,
    commit: async ({ approvalSource }) => {
      const currentInstance = playgroundStore
        .getState()
        .instances.find((instance) => instance.id === pendingWrite.instanceId);
      if (
        currentInstance != null &&
        currentInstance.model.provider !== pendingWrite.provider
      ) {
        return {
          ok: false,
          error:
            "The playground provider changed after this prompt tool diff was proposed. Please run write_prompt_tools again so the diff can be reviewed in the current provider format.",
        };
      }
      const result = applyWritePromptTools({
        playgroundStore,
        input: pendingWrite.input,
      });
      if (!result.ok) {
        return { ok: false, error: result.error };
      }
      return {
        ok: true,
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
      };
    },
    buildRejectedOutput: () => ({
      status: "rejected",
      instanceId: pendingWrite.instanceId,
      message: "User rejected the proposed prompt tool changes.",
    }),
  });
}
