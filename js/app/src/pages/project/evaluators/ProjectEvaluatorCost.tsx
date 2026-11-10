import type { ComponentProps } from "react";

import {
  EvaluatorAverageCost,
  EvaluatorCost,
} from "@phoenix/components/evaluators/EvaluatorCost";
import { ProjectEvaluatorTracingOffValue } from "@phoenix/pages/project/evaluators/ProjectEvaluatorTracingOffValue";

type ProjectEvaluatorCostProps = ComponentProps<typeof EvaluatorCost> & {
  /** Cost is measured from traces, which stop while tracing is off. */
  isTracingEnabled: boolean;
};

/**
 * Whether the cost cell stands in "tracing off" for the measured cost. Code
 * evaluators make no LLM calls, so they keep showing `--` either way.
 */
function isCostUnmeasured({
  evaluatorKind,
  isTracingEnabled,
}: Pick<ProjectEvaluatorCostProps, "evaluatorKind" | "isTracingEnabled">) {
  return !isTracingEnabled && evaluatorKind !== "CODE";
}

/** A project evaluator's total cost, or "tracing off" while it is not measured. */
export function ProjectEvaluatorCost({
  isTracingEnabled,
  ...costProps
}: ProjectEvaluatorCostProps) {
  if (isCostUnmeasured({ ...costProps, isTracingEnabled })) {
    return <ProjectEvaluatorTracingOffValue measure="Cost" />;
  }
  return <EvaluatorCost {...costProps} />;
}

/** A project evaluator's average cost per evaluation, or "tracing off" while it is not measured. */
export function ProjectEvaluatorAverageCost({
  isTracingEnabled,
  ...costProps
}: ProjectEvaluatorCostProps & { runCount: number }) {
  if (isCostUnmeasured({ ...costProps, isTracingEnabled })) {
    return <ProjectEvaluatorTracingOffValue measure="Cost" />;
  }
  return <EvaluatorAverageCost {...costProps} />;
}
