import type {
  BindPendingApprovalOptions,
  PendingApprovalActions,
  PendingApprovalIdentity,
} from "./types";

/**
 * Attach accept/reject/cancel callbacks to an approval-gated write proposal.
 *
 * This is the single generic lifecycle shared by every approval tool. Each
 * path clears the pending entry from the store first, then:
 * - `accept` runs the tool's `commit` and emits its `output` (or an error);
 * - `reject` emits the tool's rejected output;
 * - `cancel` (navigation-cancel) emits the tool's `navigationCancelError`.
 *
 * In bypass edit mode the caller invokes `accept({ approvalSource: "auto" })`
 * directly; in manual mode the inline Accept/Reject card calls `accept`/`reject`
 * on the user's click, and the owning surface's unmount cleanup calls `cancel`.
 *
 * The tool-specific `commit` returns the full model-facing output object, so
 * consolidating the lifecycle preserves each tool's existing output shape.
 *
 * @param options - the pending data plus tool-specific behaviors; see
 *   {@link BindPendingApprovalOptions}
 * @returns the pending member `T` with `accept`/`reject`/`cancel` attached
 */
export function bindPendingApproval<
  T extends PendingApprovalIdentity & PendingApprovalActions,
>({
  pending,
  commit,
  buildRejectedOutput,
  navigationCancelError,
  addToolOutput,
  clearPending,
}: BindPendingApprovalOptions<T>): T {
  const { toolCallId, toolName } = pending;
  const actions: PendingApprovalActions = {
    accept: async ({ approvalSource = "user" } = {}) => {
      clearPending(toolCallId);
      const result = await commit({ approvalSource });
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
        output: result.output,
      });
    },
    reject: async () => {
      clearPending(toolCallId);
      await addToolOutput({
        state: "output-available",
        tool: toolName,
        toolCallId,
        output: buildRejectedOutput(),
      });
    },
    // Only approvals with a navigation-cancel path get a `cancel` callback.
    ...(navigationCancelError != null
      ? {
          cancel: async () => {
            clearPending(toolCallId);
            await addToolOutput({
              state: "output-error",
              tool: toolName,
              toolCallId,
              errorText: navigationCancelError,
            });
          },
        }
      : {}),
  };
  // The spread reunites the serializable data with the freshly bound behavior;
  // TypeScript cannot prove the result is exactly `T`, hence the assertion.
  return { ...pending, ...actions } as T;
}
