import { bindPendingApproval } from "@phoenix/agent/shared/pendingApproval";

import { EDIT_PROMPT_NAVIGATION_CANCEL_ERROR } from "./constants";
import { computePromptEditSummary } from "./diffSummary";
import { applyPromptOperations, getPromptSnapshot } from "./promptStore";
import type { BindPendingPromptEditOptions, PendingPromptEdit } from "./types";

/**
 * Attaches accept/reject/cancel callbacks to a pending prompt edit using the
 * live AI SDK tool-call context that created the proposal. The generic
 * lifecycle (clear-on-resolve, output emission, navigation-cancel) lives in
 * {@link bindPendingApproval}; only the commit — a revision re-check followed by
 * applying the operations — is prompt-specific.
 */
export function bindPendingPromptEditActions({
  pendingEdit,
  playgroundStore,
  addToolOutput,
  clearPending,
}: BindPendingPromptEditOptions): PendingPromptEdit {
  return bindPendingApproval<PendingPromptEdit>({
    pending: pendingEdit,
    addToolOutput,
    clearPending,
    navigationCancelError: EDIT_PROMPT_NAVIGATION_CANCEL_ERROR,
    commit: async ({ approvalSource }) => {
      const current = getPromptSnapshot({
        playgroundStore,
        instanceId: pendingEdit.instanceId,
      });
      if (!current.ok) {
        return { ok: false, error: current.error };
      }
      if (current.output.revision !== pendingEdit.expectedRevision) {
        return {
          ok: false,
          error:
            "The prompt was changed after this edit was proposed, so it can no longer be applied.",
        };
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
      return {
        ok: true,
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
      };
    },
    buildRejectedOutput: () => ({
      status: "rejected",
      instanceId: pendingEdit.instanceId,
      message: "User rejected the proposed prompt edit.",
    }),
  });
}
