import type { ApprovalSource } from "./types";

/** Whether the user (or bypass mode) let an approval-gated write proceed. */
export type ApprovalDecision = "accepted" | "rejected";

/**
 * The machine-readable record of an approval decision, carried under a reserved
 * `approval` key in an approval-gated tool's output.
 */
export type ApprovalOutcome = {
  approval: {
    decision: ApprovalDecision;
    source: ApprovalSource;
  };
};

/**
 * Build the approval marker that every approval-gated tool stamps into its
 * accept/reject output.
 *
 * The marker exists so consumers of PXI traces (notably the `suggestion_accepted`
 * online eval) can tell that a tool call was approval-gated, and how it was
 * decided, *without* matching against a hand-maintained list of tool names. It
 * is deliberately:
 *
 * - **nested**, because some tools spread their underlying action result into
 *   the output (see `pendingSavePrompt`), which would clobber any top-level key;
 * - **additive**, leaving each tool's existing `status`/`acceptedBy` keys alone
 *   so the tool-card UI keeps parsing exactly what it parses today.
 *
 * Absence is meaningful: a tool output with no `approval` key did not express an
 * approval decision. Cancellations and still-pending proposals stay unmarked.
 *
 * One known exception, pre-dating this marker: `submit_code_evaluator_draft` and
 * `submit_llm_evaluator_draft` resolve with `status: "awaiting_user"` and the
 * user's real decision happens later in a dialog whose outcome is never written
 * back as tool output. Those decisions are invisible in traces whether or not
 * they are marked — closing that gap means emitting a terminal tool output from
 * the dialog's resolve/close paths. Tracked in
 * https://github.com/Arize-ai/phoenix/issues/15033.
 *
 * The server promotes this marker onto the emitted TOOL span as the
 * `pxi.approval.decision` / `pxi.approval.source` attributes — see
 * `src/phoenix/server/agents/approval.py`. Renaming or
 * reshaping this object is a cross-language contract change.
 */
export function approvalOutcome({
  decision,
  source,
}: {
  decision: ApprovalDecision;
  source: ApprovalSource;
}): ApprovalOutcome {
  return { approval: { decision, source } };
}
