import type { BindPendingApprovalOptions, PendingApproval } from "./types";

/**
 * Attach accept/reject callbacks to a proposed, approval-gated write. `accept`
 * clears the pending entry, runs the write via `apply`, and reports the outcome
 * to the model; `reject` clears the entry and reports `rejectedMessage`. In
 * bypass edit mode the caller invokes `accept({ approvalSource: "auto" })`
 * directly; in manual mode the inline card calls these on the user's click.
 *
 * This is the generic core shared by every approval-gated write tool — supply a
 * `TPreview` for the card payload and a per-domain `rejectedMessage`.
 */
export function bindPendingApproval<TPreview>({
  pending,
  apply,
  addToolOutput,
  setPending,
  rejectedMessage,
}: BindPendingApprovalOptions<TPreview>): PendingApproval<TPreview> {
  const { toolCallId, toolName } = pending;
  return {
    ...pending,
    accept: async ({ approvalSource = "user" } = {}) => {
      setPending(toolCallId, null);
      const result = await apply();
      if (!result.ok) {
        await addToolOutput({
          state: "output-error",
          tool: toolName,
          toolCallId,
          errorText: result.error,
        });
        return;
      }
      await addToolOutput({
        state: "output-available",
        tool: toolName,
        toolCallId,
        output: {
          status: "accepted",
          acceptedBy: approvalSource,
          message: result.output,
        },
      });
    },
    reject: async () => {
      setPending(toolCallId, null);
      await addToolOutput({
        state: "output-available",
        tool: toolName,
        toolCallId,
        output: { status: "rejected", message: rejectedMessage },
      });
    },
  };
}
