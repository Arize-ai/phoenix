import type { PendingApprovalsByToolCallId } from "./registry";

/**
 * Navigation-cancel every pending approval owned by one of `toolNames`,
 * discarding the proposal and reporting the cancel to the model.
 *
 * A surface (e.g. the playground, or an evaluator dialog) calls this from its
 * unmount cleanup for the approval tools it hosts, so a proposal left
 * unresolved when its editor closes is not silently stranded. Approvals owned
 * by other surfaces are left untouched.
 */
export function cancelPendingApprovalsForTools({
  pendingApprovalsByToolCallId,
  toolNames,
}: {
  pendingApprovalsByToolCallId: PendingApprovalsByToolCallId;
  toolNames: readonly string[];
}): void {
  const owned = new Set(toolNames);
  for (const pending of Object.values(pendingApprovalsByToolCallId)) {
    if (pending && owned.has(pending.toolName)) {
      void pending.cancel?.();
    }
  }
}
