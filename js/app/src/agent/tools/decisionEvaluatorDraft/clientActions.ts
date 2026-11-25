import { approvalOutcome } from "@phoenix/agent/shared/pendingApproval";
import {
  createEvaluatorSubmitClientAction,
  type EvaluatorSubmitResult,
  type ApprovalSource,
} from "@phoenix/agent/tools/approval";
import { parseEmptyToolInput } from "@phoenix/agent/tools/emptyToolInput";
import { isOperationCallApprovalGranted } from "@phoenix/agent/uiOperations/scriptApprovalGrant";
import { parseUIOperationCallContext } from "@phoenix/agent/uiOperations/types";
import type { AgentClientActionResult } from "@phoenix/store/agentStore";

import {
  type DecisionEvaluatorDraftSnapshot,
  editDecisionEvaluatorDraftInputSchema,
  type EditDecisionEvaluatorDraftOperation,
} from "./draft";
import type { DecisionModelOption } from "./models";

export type DecisionEvaluatorDraftHost = {
  getSnapshot: () => DecisionEvaluatorDraftSnapshot;
  /** The decision models the form's model menu offers. */
  loadAvailableModels: () => Promise<DecisionModelOption[]>;
  applyOperations: (
    operations: EditDecisionEvaluatorDraftOperation[],
    options?: { availableModels?: readonly DecisionModelOption[] }
  ) =>
    | { ok: true; output: DecisionEvaluatorDraftSnapshot }
    | { ok: false; error: string };
  submit: (options: {
    approvalSource: ApprovalSource;
  }) => Promise<EvaluatorSubmitResult>;
};

const NOT_MOUNTED_ERROR =
  "No project decision-evaluator form is open; cannot reach the draft.";

export function createReadDecisionEvaluatorDraftClientAction({
  getDraftHost,
}: {
  getDraftHost: () => DecisionEvaluatorDraftHost | null;
}) {
  return async (): Promise<AgentClientActionResult> => {
    const host = getDraftHost();
    if (!host) {
      return { ok: false, error: NOT_MOUNTED_ERROR };
    }
    const snapshot = host.getSnapshot();
    try {
      return {
        ok: true,
        output: {
          ...snapshot,
          availableModels: await host.loadAvailableModels(),
        },
      };
    } catch {
      // The draft is still worth reading when the model catalog is not.
      return { ok: true, output: { ...snapshot, availableModels: null } };
    }
  };
}

/**
 * Applies decision draft edits under the enclosing script's approval, the
 * consent the other draft edits use. An edit that would leave the decision
 * invalid is refused whole, so the form never shows half of it.
 */
export function createEditDecisionEvaluatorDraftClientAction({
  getDraftHost,
  shouldAutoAccept = () => false,
}: {
  getDraftHost: () => DecisionEvaluatorDraftHost | null;
  shouldAutoAccept?: () => boolean;
}) {
  return async (
    input: unknown,
    context?: unknown
  ): Promise<AgentClientActionResult> => {
    const callContext = parseUIOperationCallContext(context);
    if (!callContext) {
      return {
        ok: false,
        error:
          "Cannot edit the decision-evaluator draft without an operation call context.",
      };
    }
    const parsed = editDecisionEvaluatorDraftInputSchema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        error: `Invalid evaluators.decision.edit input: ${parsed.error.issues
          .map(({ path, message }) =>
            path.length ? `${path.join(".")}: ${message}` : message
          )
          .join("; ")}`,
      };
    }
    if (
      !shouldAutoAccept() &&
      !isOperationCallApprovalGranted(callContext.callId)
    ) {
      return {
        ok: false,
        error:
          "Editing the decision draft needs an approved script; describe the change in write_description.",
      };
    }
    const host = getDraftHost();
    if (!host) {
      return { ok: false, error: NOT_MOUNTED_ERROR };
    }
    const { operations } = parsed.data;
    let availableModels: DecisionModelOption[] | undefined;
    if (operations.some(({ type }) => type === "set_model")) {
      try {
        availableModels = await host.loadAvailableModels();
      } catch (error) {
        return {
          ok: false,
          error: `Could not load the decision models, so nothing was changed: ${
            error instanceof Error ? error.message : String(error)
          }`,
        };
      }
      if (getDraftHost() !== host) {
        return { ok: false, error: NOT_MOUNTED_ERROR };
      }
    }
    const applied = host.applyOperations(operations, { availableModels });
    if (!applied.ok) {
      return applied;
    }
    return {
      ok: true,
      output: {
        status: "accepted",
        draft: applied.output,
        ...approvalOutcome({ decision: "accepted", source: "auto" }),
      },
    };
  };
}

export function createSubmitDecisionEvaluatorDraftClientAction({
  getDraftHost,
  shouldAutoAccept = () => false,
}: {
  getDraftHost: () => DecisionEvaluatorDraftHost | null;
  shouldAutoAccept?: () => boolean;
}) {
  return createEvaluatorSubmitClientAction({
    getDraftHost,
    parseInput: parseEmptyToolInput,
    invalidInputError: "Invalid evaluators.decision.submit input. Expected {}.",
    notMountedError: NOT_MOUNTED_ERROR,
    shouldAutoAccept,
  });
}
