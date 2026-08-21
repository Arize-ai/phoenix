import type { AgentClientActionResult } from "@phoenix/store/agentStore";

import type { ApprovalApplyResult, PendingApproval } from "./types";

/**
 * Stage an approval-gated write on behalf of a `ui.*` operation call and
 * return the promise the calling `execute_ui` script awaits. The operation
 * counterpart of {@link bindPendingApproval} + `stage*Write`: instead of
 * reporting the outcome through `addToolOutput` (the retired one-tool-call
 * contract), accept/reject resolve the returned promise —
 * `{ ok: true, output: { status: "accepted" | "rejected", … } }` — so the
 * script parked on the `await` continues with the user's decision. A failed
 * apply resolves `{ ok: false, error }`.
 *
 * `pending.toolCallId` is the inner operation call id
 * (`<executeUiToolCallId>:<sequence>`), so the staged entry renders as a
 * child approval card of its `execute_ui` call and interrupt/rewind cleanup
 * clears it by prefix.
 */
export function stageApprovalOperation<TPreview>({
  pending,
  apply,
  setPending,
  shouldAutoAccept,
  rejectedMessage,
}: {
  pending: Pick<
    PendingApproval<TPreview>,
    "toolCallId" | "toolName" | "preview"
  >;
  /** Performs the actual write; called only on accept (or auto-accept). */
  apply: () => Promise<ApprovalApplyResult>;
  setPending: (
    toolCallId: string,
    pending: PendingApproval<TPreview> | null
  ) => void;
  /** Bypass edit mode auto-accepts without staging a card. */
  shouldAutoAccept: () => boolean;
  /** Message resolved to the model when the user rejects. */
  rejectedMessage: string;
}): Promise<AgentClientActionResult> {
  const { toolCallId } = pending;
  return new Promise((resolve) => {
    const bound: PendingApproval<TPreview> = {
      ...pending,
      accept: async ({ approvalSource = "user" } = {}) => {
        setPending(toolCallId, null);
        const result = await apply();
        if (!result.ok) {
          resolve({ ok: false, error: result.error });
          return;
        }
        resolve({
          ok: true,
          output: {
            status: "accepted",
            acceptedBy: approvalSource,
            message: result.output,
          },
        });
      },
      reject: async () => {
        setPending(toolCallId, null);
        resolve({
          ok: true,
          output: { status: "rejected", message: rejectedMessage },
        });
      },
    };
    if (shouldAutoAccept()) {
      void bound.accept?.({ approvalSource: "auto" });
      return;
    }
    setPending(toolCallId, bound);
  });
}
