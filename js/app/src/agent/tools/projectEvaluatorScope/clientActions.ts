import { approvalOutcome } from "@phoenix/agent/shared/pendingApproval";
import { isOperationCallApprovalGranted } from "@phoenix/agent/uiOperations/scriptApprovalGrant";
import { parseUIOperationCallContext } from "@phoenix/agent/uiOperations/types";
import type {
  ProjectEvaluatorScope,
  ProjectEvaluatorTarget,
} from "@phoenix/pages/project/evaluators/projectEvaluatorTypes";
import type { AgentClientActionResult } from "@phoenix/store/agentStore";

import {
  applyProjectEvaluatorScopePatch,
  editProjectEvaluatorScopeInputSchema,
  type ProjectEvaluatorScopePatch,
  type ProjectEvaluatorScopeSnapshot,
  toProjectEvaluatorScopeSnapshot,
} from "./scope";

export type ProjectEvaluatorFilterValidation = {
  isValid: boolean;
  errorMessage?: string | null;
};

/** What the open project evaluator form exposes to the scope operations. */
export type ProjectEvaluatorScopeHost = {
  getScope: () => ProjectEvaluatorScope;
  isTargetEditable: () => boolean;
  getRememberedFilters: () => Partial<Record<ProjectEvaluatorTarget, string>>;
  validateFilter: (params: {
    targetType: ProjectEvaluatorTarget;
    filterCondition: string;
  }) => Promise<ProjectEvaluatorFilterValidation>;
  /** Writes the scope into the form, the way the fields would. */
  applyScope: (scope: ProjectEvaluatorScope) => void;
};

const NOT_MOUNTED_ERROR =
  "No project evaluator form is open; open one from the project's Evaluators tab.";

function readSnapshot(
  host: ProjectEvaluatorScopeHost
): ProjectEvaluatorScopeSnapshot {
  return toProjectEvaluatorScopeSnapshot({
    scope: host.getScope(),
    isTargetEditable: host.isTargetEditable(),
  });
}

export function createReadProjectEvaluatorScopeClientAction({
  getHost,
}: {
  getHost: () => ProjectEvaluatorScopeHost | null;
}) {
  return async (): Promise<AgentClientActionResult> => {
    const host = getHost();
    if (!host) {
      return { ok: false, error: NOT_MOUNTED_ERROR };
    }
    return { ok: true, output: readSnapshot(host) };
  };
}

/**
 * Applies a scope patch to the open form. The patch is checked by the same
 * rules the fields enforce, and a filter is validated against the project
 * before it lands, so the form never holds a scope it would refuse to save.
 * Consent is the enclosing script's approval, as for the other draft edits.
 */
export function createEditProjectEvaluatorScopeClientAction({
  getHost,
  shouldAutoAccept = () => false,
}: {
  getHost: () => ProjectEvaluatorScopeHost | null;
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
          "Cannot edit the evaluator scope without an operation call context.",
      };
    }
    const parsed = editProjectEvaluatorScopeInputSchema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        error: `Invalid evaluators.project.scope.edit input: ${parsed.error.issues
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
          "Editing the evaluator scope needs an approved script; describe the change in write_description.",
      };
    }
    const host = getHost();
    if (!host) {
      return { ok: false, error: NOT_MOUNTED_ERROR };
    }
    return applyPatch({ host, getHost, patch: parsed.data });
  };
}

async function applyPatch({
  host,
  getHost,
  patch,
}: {
  host: ProjectEvaluatorScopeHost;
  getHost: () => ProjectEvaluatorScopeHost | null;
  patch: ProjectEvaluatorScopePatch;
}): Promise<AgentClientActionResult> {
  const before = host.getScope();
  const next = applyProjectEvaluatorScopePatch({
    scope: before,
    patch,
    isTargetEditable: host.isTargetEditable(),
    rememberedFilters: host.getRememberedFilters(),
  });
  if (!next.ok) {
    return next;
  }
  const { scope } = next;
  if (
    scope.filterCondition !== before.filterCondition ||
    scope.targetType !== before.targetType
  ) {
    const validation = await host.validateFilter({
      targetType: scope.targetType,
      filterCondition: scope.filterCondition,
    });
    if (!validation.isValid) {
      return {
        ok: false,
        error: `The ${scope.targetType.toLowerCase()} filter \`${scope.filterCondition}\` is invalid: ${validation.errorMessage ?? "it does not parse"}. The scope was not changed.`,
      };
    }
  }
  // Validation is a round trip; a form closed meanwhile is not written to.
  if (getHost() !== host) {
    return { ok: false, error: NOT_MOUNTED_ERROR };
  }
  host.applyScope(scope);
  return {
    ok: true,
    output: {
      status: "accepted",
      scope: toProjectEvaluatorScopeSnapshot({
        scope,
        isTargetEditable: host.isTargetEditable(),
      }),
      ...approvalOutcome({ decision: "accepted", source: "auto" }),
    },
  };
}
