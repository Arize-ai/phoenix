import { approvalOutcome } from "@phoenix/agent/shared/pendingApproval";
import {
  type ApprovalSource,
  createEvaluatorSubmitClientAction,
  type EvaluatorSubmitResult,
} from "@phoenix/agent/tools/approval";
import { parseEmptyToolInput } from "@phoenix/agent/tools/emptyToolInput";
import { isOperationCallApprovalGranted } from "@phoenix/agent/uiOperations/scriptApprovalGrant";
import { parseUIOperationCallContext } from "@phoenix/agent/uiOperations/types";
import type { AgentClientActionResult } from "@phoenix/store/agentStore";
import type { EvaluatorInputMapping } from "@phoenix/types";

import {
  applyProjectEvaluatorAttachEdit,
  editProjectEvaluatorAttachInputSchema,
  type ProjectEvaluatorAttachSnapshot,
} from "./attach";

/** What an open attach form exposes to the attach operations. */
export type ProjectEvaluatorAttachHost = {
  getSnapshot: () => ProjectEvaluatorAttachSnapshot;
  /** Writes the mapping into the form, the way the mapping rows would. */
  applyInputMapping: (inputMapping: EvaluatorInputMapping) => void;
  submit: (options: {
    approvalSource: ApprovalSource;
  }) => Promise<EvaluatorSubmitResult>;
};

const NOT_MOUNTED_ERROR =
  "No attach form is open; open one with navigation.goTo to " +
  "/projects/<projectId>/evaluators/new/attach/<evaluatorId>.";

export function createReadProjectEvaluatorAttachClientAction({
  getHost,
}: {
  getHost: () => ProjectEvaluatorAttachHost | null;
}) {
  return async (): Promise<AgentClientActionResult> => {
    const host = getHost();
    if (!host) {
      return { ok: false, error: NOT_MOUNTED_ERROR };
    }
    return { ok: true, output: host.getSnapshot() };
  };
}

/**
 * Changes the project's input mapping on the open attach form, under the
 * enclosing script's approval as the other form edits are.
 */
export function createEditProjectEvaluatorAttachClientAction({
  getHost,
  shouldAutoAccept = () => false,
}: {
  getHost: () => ProjectEvaluatorAttachHost | null;
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
        error: "Cannot edit the attach form without an operation call context.",
      };
    }
    const parsed = editProjectEvaluatorAttachInputSchema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        error: `Invalid evaluators.project.attach.edit input: ${parsed.error.issues
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
          "Editing the attach form needs an approved script; describe the change in write_description.",
      };
    }
    const host = getHost();
    if (!host) {
      return { ok: false, error: NOT_MOUNTED_ERROR };
    }
    const applied = applyProjectEvaluatorAttachEdit({
      snapshot: host.getSnapshot(),
      input: parsed.data,
    });
    if (!applied.ok) {
      return applied;
    }
    host.applyInputMapping(applied.inputMapping);
    return {
      ok: true,
      output: {
        status: "accepted",
        attach: host.getSnapshot(),
        ...approvalOutcome({ decision: "accepted", source: "auto" }),
      },
    };
  };
}

export function createSubmitProjectEvaluatorAttachClientAction({
  getHost,
  shouldAutoAccept = () => false,
}: {
  getHost: () => ProjectEvaluatorAttachHost | null;
  shouldAutoAccept?: () => boolean;
}) {
  return createEvaluatorSubmitClientAction({
    getDraftHost: getHost,
    parseInput: parseEmptyToolInput,
    invalidInputError:
      "Invalid evaluators.project.attach.submit input. Expected {}.",
    notMountedError: NOT_MOUNTED_ERROR,
    shouldAutoAccept,
  });
}
