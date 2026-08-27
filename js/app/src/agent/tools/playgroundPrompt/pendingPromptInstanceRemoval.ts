import { approvalOutcome } from "@phoenix/agent/shared/pendingApproval";

import { REMOVE_PROMPT_INSTANCE_NAVIGATION_CANCEL_ERROR } from "./constants";
import { removePromptInstance } from "./promptStore";
import type {
  BindPendingPromptInstanceRemovalOptions,
  PendingPromptInstanceRemoval,
} from "./types";

/**
 * Attaches accept/reject callbacks to a pending instance removal. Each
 * callback resolves the awaiting `execute_browser_action` script call via `emitResult`;
 * see `bindPendingPromptEditActions` for the result contract.
 */
export function bindPendingPromptInstanceRemovalActions({
  pendingRemoval,
  playgroundStore,
  emitResult,
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
        emitResult({ ok: false, error: result.error });
        return;
      }
      emitResult({
        ok: true,
        output: {
          ...result.output,
          acceptedBy: approvalSource,
          message:
            approvalSource === "auto"
              ? "Prompt instance removal auto-approved."
              : "Prompt instance removed.",
          ...approvalOutcome({ decision: "accepted", source: approvalSource }),
        },
      });
    },
    reject: async () => {
      setPendingPromptInstanceRemoval(pendingRemoval.toolCallId, null);
      emitResult({
        ok: true,
        output: {
          status: "rejected",
          instanceId: pendingRemoval.instanceId,
          label: pendingRemoval.label,
          message: "User rejected the prompt instance removal.",
          ...approvalOutcome({ decision: "rejected", source: "user" }),
        },
      });
    },
    cancel: async () => {
      setPendingPromptInstanceRemoval(pendingRemoval.toolCallId, null);
      emitResult({
        ok: false,
        error: REMOVE_PROMPT_INSTANCE_NAVIGATION_CANCEL_ERROR,
      });
    },
  };
}
