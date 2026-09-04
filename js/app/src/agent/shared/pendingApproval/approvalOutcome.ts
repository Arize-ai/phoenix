import type { ApprovalSource } from "./types";

export type ApprovalDecision = "accepted" | "rejected";

export type ApprovalOutcome = {
  approval: {
    decision: ApprovalDecision;
    source: ApprovalSource;
  };
};

/** Build the approval marker promoted to `pxi.approval.*` span attributes. */
export function approvalOutcome({
  decision,
  source,
}: {
  decision: ApprovalDecision;
  source: ApprovalSource;
}): ApprovalOutcome {
  return { approval: { decision, source } };
}
