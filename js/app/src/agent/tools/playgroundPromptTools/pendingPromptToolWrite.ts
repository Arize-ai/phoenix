import { approvalOutcome } from "@phoenix/agent/shared/pendingApproval";

import { WRITE_PROMPT_TOOLS_NAVIGATION_CANCEL_ERROR } from "./constants";
import { applyWritePromptTools } from "./promptToolsStore";
import type {
  BindPendingPromptToolWriteOptions,
  PendingPromptToolWrite,
} from "./types";

/**
 * Attaches accept/reject/cancel callbacks to a pending tool-write batch. Each
 * callback resolves the awaiting `execute_ui` script call via `emitResult`;
 * see `bindPendingPromptEditActions` for the result contract. The batch is
 * re-applied on accept (which re-checks the revision against the current
 * store), so a tool list that drifted between propose and accept is rejected
 * with the stale error.
 */
export function bindPendingPromptToolWriteActions({
  pendingWrite,
  playgroundStore,
  emitResult,
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
        emitResult({
          ok: false,
          error:
            "The playground provider changed after this prompt tool diff was proposed. Please run playground.prompt.tools.write again so the diff can be reviewed in the current provider format.",
        });
        return;
      }
      const result = applyWritePromptTools({
        playgroundStore,
        input: pendingWrite.input,
      });
      if (!result.ok) {
        emitResult({ ok: false, error: result.error });
        return;
      }
      emitResult({
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
          ...approvalOutcome({ decision: "accepted", source: approvalSource }),
        },
      });
    },
    reject: async () => {
      setPendingPromptToolWrite(pendingWrite.toolCallId, null);
      emitResult({
        ok: true,
        output: {
          status: "rejected",
          instanceId: pendingWrite.instanceId,
          message: "User rejected the proposed prompt tool changes.",
          ...approvalOutcome({ decision: "rejected", source: "user" }),
        },
      });
    },
    cancel: async () => {
      setPendingPromptToolWrite(pendingWrite.toolCallId, null);
      emitResult({
        ok: false,
        error: WRITE_PROMPT_TOOLS_NAVIGATION_CANCEL_ERROR,
      });
    },
  };
}
