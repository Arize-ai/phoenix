import { useMemo } from "react";
import { useParams } from "react-router";

import type { AgentContext } from "@phoenix/agent/context/agentContextTypes";
import { useAdvertiseAgentContext } from "@phoenix/agent/context/useAdvertiseAgentContext";

type ProjectEvaluatorAgentContext = Extract<
  AgentContext,
  { type: "project_evaluator" }
>;

/**
 * The context a mounted project evaluator form advertises: which project it
 * scores, which evaluator it edits (none while creating), and what kind of
 * evaluator it holds, so PXI knows which parts of the form it can drive.
 */
export function getProjectEvaluatorFormContext({
  projectNodeId,
  projectEvaluatorNodeId,
  form,
  evaluatorKind,
}: {
  projectNodeId: string | undefined;
  projectEvaluatorNodeId: string | undefined;
  form: "create" | "edit";
  evaluatorKind: "LLM" | "CODE";
}): ProjectEvaluatorAgentContext | null {
  if (!projectNodeId) {
    return null;
  }
  return {
    type: "project_evaluator",
    projectNodeId,
    projectEvaluatorNodeId:
      form === "edit" ? (projectEvaluatorNodeId ?? null) : null,
    form,
    evaluatorKind,
  };
}

/**
 * Advertise a project evaluator create or edit form to PXI for as long as it
 * is mounted. The project and evaluator ids come from the route the form's
 * slideover is rendered under.
 */
export function useAdvertiseProjectEvaluatorForm({
  form,
  evaluatorKind,
}: {
  form: "create" | "edit";
  evaluatorKind: "LLM" | "CODE";
}) {
  const { projectId, projectEvaluatorId } = useParams();
  const context = useMemo(
    () =>
      getProjectEvaluatorFormContext({
        projectNodeId: projectId,
        projectEvaluatorNodeId: projectEvaluatorId,
        form,
        evaluatorKind,
      }),
    [projectId, projectEvaluatorId, form, evaluatorKind]
  );
  useAdvertiseAgentContext(context);
}
