import { bindPendingApproval } from "@phoenix/agent/shared/pendingApproval";

import {
  REMOVE_PROMPT_INSTANCE_NAVIGATION_CANCEL_ERROR,
} from "./constants";
import { removePromptInstance } from "./promptStore";
import type {
  BindPendingPromptInstanceRemovalOptions,
  PendingPromptInstanceRemoval,
} from "./types";

/**
 * Attaches accept/reject/cancel callbacks to a pending prompt-instance removal.
 * The generic lifecycle lives in {@link bindPendingApproval}; only the commit
 * (removing the instance from the playground store) is removal-specific.
 */
export function bindPendingPromptInstanceRemovalActions({
  pendingRemoval,
  playgroundStore,
  addToolOutput,
  clearPending,
}: BindPendingPromptInstanceRemovalOptions): PendingPromptInstanceRemoval {
  return bindPendingApproval<PendingPromptInstanceRemoval>({
    pending: pendingRemoval,
    addToolOutput,
    clearPending,
    navigationCancelError: REMOVE_PROMPT_INSTANCE_NAVIGATION_CANCEL_ERROR,
    commit: async ({ approvalSource }) => {
      const result = removePromptInstance({
        playgroundStore,
        instanceId: pendingRemoval.instanceId,
      });
      if (!result.ok) {
        return { ok: false, error: result.error };
      }
      return {
        ok: true,
        output: {
          ...result.output,
          acceptedBy: approvalSource,
          message:
            approvalSource === "auto"
              ? "Prompt instance removal auto-approved."
              : "Prompt instance removed.",
        },
      };
    },
    buildRejectedOutput: () => ({
      status: "rejected",
      instanceId: pendingRemoval.instanceId,
      label: pendingRemoval.label,
      message: "User rejected the prompt instance removal.",
    }),
  });
}
