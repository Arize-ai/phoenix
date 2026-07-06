import type {
  PendingApproval,
  PendingApprovalsByToolCallId,
} from "./registry";

/**
 * Reads the pending approval staged for a tool call, if any.
 *
 * This is the single state-read seam every approval `*ToolDetails` component
 * uses (replacing the per-tool `state.pending*ByToolCallId[toolCallId]` reads).
 * Callers narrow the returned union by `toolName` to render their own preview.
 */
export function selectPendingApproval(
  state: { pendingApprovalsByToolCallId: PendingApprovalsByToolCallId },
  toolCallId: string
): PendingApproval | null {
  return state.pendingApprovalsByToolCallId[toolCallId] ?? null;
}
