import {
  type PendingApproval,
  selectPendingApproval,
} from "@phoenix/agent/shared/pendingApproval";
import { useAgentContext } from "@phoenix/contexts/AgentContext";

/**
 * Subscribes to the pending approval staged for `toolCallId`, narrowed to the
 * caller's own tool.
 *
 * The single state-read seam every approval `*ToolDetails` component uses: it
 * reads the unified `pendingApprovalsByToolCallId` slice via
 * {@link selectPendingApproval} and narrows the discriminated union to the
 * member matching `toolName`, returning `null` for any other (or absent) entry.
 */
export function usePendingApproval<TName extends PendingApproval["toolName"]>(
  toolCallId: string,
  toolName: TName
): Extract<PendingApproval, { toolName: TName }> | null {
  return useAgentContext((state) => {
    const approval = selectPendingApproval(state, toolCallId);
    return approval?.toolName === toolName
      ? (approval as Extract<PendingApproval, { toolName: TName }>)
      : null;
  });
}
