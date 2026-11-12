import { useContext, useEffect, useRef } from "react";

import {
  createEditProjectEvaluatorScopeClientAction,
  createReadProjectEvaluatorScopeClientAction,
  type ProjectEvaluatorFilterValidation,
  type ProjectEvaluatorScopeHost,
} from "@phoenix/agent/tools/projectEvaluatorScope";
import { registerUIOperations } from "@phoenix/agent/uiOperations/catalog";
import {
  editProjectEvaluatorScopeOperation,
  readProjectEvaluatorScopeOperation,
} from "@phoenix/agent/uiOperations/operations/projectEvaluator";
import { AgentContext } from "@phoenix/contexts/AgentContext";
import type {
  ProjectEvaluatorScope,
  ProjectEvaluatorTarget,
} from "@phoenix/pages/project/evaluators/projectEvaluatorTypes";
import { validateSessionFilterCondition } from "@phoenix/pages/project/sessionFilterValidation";
import { validateSpanFilterCondition } from "@phoenix/pages/project/spanFilterValidation";
import { validateTraceFilterCondition } from "@phoenix/pages/project/traceFilterValidation";
import { assertUnreachable } from "@phoenix/typeUtils";

/** Validates a condition in the filter language of the target it is for. */
export async function validateProjectEvaluatorFilter({
  projectId,
  targetType,
  filterCondition,
}: {
  projectId: string;
  targetType: ProjectEvaluatorTarget;
  filterCondition: string;
}): Promise<ProjectEvaluatorFilterValidation> {
  const validation = await (() => {
    switch (targetType) {
      case "SPAN":
        return validateSpanFilterCondition(filterCondition, projectId);
      case "TRACE":
        return validateTraceFilterCondition(filterCondition, projectId);
      case "SESSION":
        return validateSessionFilterCondition(filterCondition, projectId);
      default:
        return assertUnreachable(targetType);
    }
  })();
  // The project query resolves to nothing when the project is gone.
  return validation ?? { isValid: false, errorMessage: "Project not found." };
}

/**
 * Lets PXI read and edit the scope of the open project evaluator form. It
 * registers from the scope fields, which every project form (LLM, code, and
 * decision) renders, so the operations exist exactly while a form is open.
 * Writes go through `applyScope`, the same path the fields take.
 */
export function useProjectEvaluatorScopeRegistration({
  projectId,
  scope,
  isTargetEditable,
  rememberedFilters,
  applyScope,
}: {
  projectId: string;
  scope: ProjectEvaluatorScope;
  isTargetEditable: boolean;
  rememberedFilters: Partial<Record<ProjectEvaluatorTarget, string>>;
  applyScope: (scope: ProjectEvaluatorScope) => void;
}) {
  const agentStore = useContext(AgentContext);
  // Read through a ref so the registration outlives renders; `applyScope`
  // also writes the scope it applied, so a second edit in the same script
  // builds on the first before the form re-renders.
  const latestRef = useRef({
    scope,
    isTargetEditable,
    rememberedFilters,
    applyScope,
  });
  // eslint-disable-next-line react/refs
  latestRef.current = {
    scope,
    isTargetEditable,
    rememberedFilters,
    applyScope,
  };
  useEffect(() => {
    if (!agentStore) {
      return undefined;
    }
    let host: ProjectEvaluatorScopeHost | null = {
      getScope: () => latestRef.current.scope,
      isTargetEditable: () => latestRef.current.isTargetEditable,
      getRememberedFilters: () => latestRef.current.rememberedFilters,
      validateFilter: ({ targetType, filterCondition }) =>
        validateProjectEvaluatorFilter({
          projectId,
          targetType,
          filterCondition,
        }),
      applyScope: (next) => {
        latestRef.current.applyScope(next);
        latestRef.current = { ...latestRef.current, scope: next };
      },
    };
    const getHost = () => host;
    const unregister = registerUIOperations({
      agentStore,
      operations: [
        {
          descriptor: readProjectEvaluatorScopeOperation,
          handler: createReadProjectEvaluatorScopeClientAction({ getHost }),
        },
        {
          descriptor: editProjectEvaluatorScopeOperation,
          handler: createEditProjectEvaluatorScopeClientAction({
            getHost,
            shouldAutoAccept: () =>
              agentStore.getState().permissions.edits === "bypass",
          }),
        },
      ],
    });
    return () => {
      host = null;
      unregister();
    };
  }, [agentStore, projectId]);
}
