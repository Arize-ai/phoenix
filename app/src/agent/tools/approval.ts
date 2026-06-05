/**
 * Who resolved a pending tool approval. `"user"` means a person clicked the
 * inline Accept button; `"auto"` means it was approved by the current edit
 * permission mode.
 *
 * Shared by every approval-gated agent tool (e.g. prompt edits, prompt saves,
 * and span annotations) so no tool module has to depend on another for the type.
 */
export type ApprovalSource = "user" | "auto";

/**
 * Terminal outcome of persisting an evaluator through the dialog's validated
 * mutation path (the same path the manual Create/Update button drives). On
 * success it carries the persisted evaluator identity the manual flow produces;
 * on failure it carries an actionable message (validation, missing prerequisite,
 * or server/mutation error) so the agent never reports a false accept.
 *
 * Shared by the code and LLM evaluator draft hosts so neither tool module has to
 * depend on the other for the type.
 */
export type EvaluatorSubmitResult =
  | {
      ok: true;
      acceptedBy: ApprovalSource;
      evaluator: { id: string; name: string };
    }
  | { ok: false; error: string };

/**
 * Builds the `submit` capability shared by the code and LLM evaluator draft
 * hosts. `getHandleSubmit` returns the dialog's current validated submit (the
 * same function the manual Create/Update button drives) or `null` when the form
 * is unmounted; routing through an accessor lets the long-lived host
 * registration always invoke the latest `handleSubmit` without re-registering.
 *
 * On success it stamps `acceptedBy` with the caller's approval source so the
 * bypass path is marked `"auto"` exactly as the manual path is marked `"user"`.
 */
export function createEvaluatorHostSubmit({
  getHandleSubmit,
  unmountedError,
}: {
  getHandleSubmit: () => (() => Promise<EvaluatorSubmitResult>) | null;
  unmountedError: string;
}) {
  return async ({
    approvalSource,
  }: {
    approvalSource: ApprovalSource;
  }): Promise<EvaluatorSubmitResult> => {
    const handleSubmit = getHandleSubmit();
    if (!handleSubmit) {
      return { ok: false, error: unmountedError };
    }
    const result = await handleSubmit();
    if (!result.ok) {
      return result;
    }
    return { ...result, acceptedBy: approvalSource };
  };
}
