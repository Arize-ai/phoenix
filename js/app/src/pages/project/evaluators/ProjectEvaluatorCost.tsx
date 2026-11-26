import { css } from "@emotion/react";
import type { ComponentProps } from "react";
import { Suspense } from "react";
import { graphql, useFragment } from "react-relay";

import { Skeleton } from "@phoenix/components";
import {
  EvaluatorAverageCost,
  EvaluatorCost,
} from "@phoenix/components/evaluators/EvaluatorCost";
import { evaluatorKindHasCost } from "@phoenix/components/evaluators/evaluatorCostUtils";
import { TextErrorBoundaryFallback } from "@phoenix/components/exception";
import type {
  ProjectEvaluatorCost_cost$data,
  ProjectEvaluatorCost_cost$key,
} from "@phoenix/pages/project/evaluators/__generated__/ProjectEvaluatorCost_cost.graphql";
import { useEvaluatorDeferredError } from "@phoenix/pages/project/evaluators/ProjectEvaluatorMeanScoreCell";
import { ProjectEvaluatorTracingOffValue } from "@phoenix/pages/project/evaluators/ProjectEvaluatorTracingOffValue";
import type { EvaluatorKind } from "@phoenix/types";

type ProjectEvaluatorCostProps = ComponentProps<typeof EvaluatorCost> & {
  /** Cost is measured from traces, which stop while tracing is off. */
  isTracingEnabled: boolean;
};

/**
 * Whether the cost cell stands in "tracing off" for the measured cost.
 * Evaluators that make no model calls keep showing `--` either way.
 */
function isCostUnmeasured({
  evaluatorKind,
  isTracingEnabled,
}: {
  evaluatorKind: EvaluatorKind;
  isTracingEnabled: boolean;
}) {
  return !isTracingEnabled && evaluatorKindHasCost(evaluatorKind);
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
}: ProjectEvaluatorCostProps & { runCount: number | null | undefined }) {
  if (isCostUnmeasured({ ...costProps, isTracingEnabled })) {
    return <ProjectEvaluatorTracingOffValue measure="Cost" />;
  }
  return <EvaluatorAverageCost {...costProps} />;
}

type ProjectEvaluatorCostCellProps = {
  /** Which of the two cost columns this cell is. */
  measure: "total" | "average";
  evaluatorKind: EvaluatorKind;
  isTracingEnabled: boolean;
  /** The row, whose cost the table's query defers. */
  projectEvaluator: ProjectEvaluatorCost_cost$key;
};

/**
 * A cost column's cell in the project evaluators table. The table defers
 * the cost, so the cell holds a skeleton until it arrives; an evaluator
 * whose cost is never measured (no model calls, or tracing off) renders
 * its placeholder at once without waiting on, or reading, the cost.
 */
export function ProjectEvaluatorCostCell(props: ProjectEvaluatorCostCellProps) {
  const { evaluatorKind, isTracingEnabled } = props;
  if (!evaluatorKindHasCost(evaluatorKind)) {
    return <EvaluatorCost evaluatorKind={evaluatorKind} costSummary={null} />;
  }
  if (!isTracingEnabled) {
    return <ProjectEvaluatorTracingOffValue measure="Cost" />;
  }
  return (
    <Suspense fallback={<ProjectEvaluatorCostCellSkeleton />}>
      <MeasuredProjectEvaluatorCostCell {...props} />
    </Suspense>
  );
}

/**
 * The cost fragment as a cell reads it. Relay types its fields as present,
 * but a refetch reads the deferred cost as undefined, without suspending,
 * until its part arrives; a cost that is not measured is null. Read through
 * this object type, rather than annotated in a destructuring, the fields
 * keep `undefined`: TypeScript would narrow the bindings to the generated
 * types.
 */
type DeferredCost = {
  costSummary: ProjectEvaluatorCost_cost$data["costSummary"] | undefined;
  tracedEvaluationCount:
    | ProjectEvaluatorCost_cost$data["tracedEvaluationCount"]
    | undefined;
};

function MeasuredProjectEvaluatorCostCell({
  measure,
  evaluatorKind,
  projectEvaluator,
}: ProjectEvaluatorCostCellProps) {
  const cost: DeferredCost = useFragment(
    graphql`
      fragment ProjectEvaluatorCost_cost on ProjectEvaluator
      @argumentDefinitions(timeRange: { type: "TimeRange!" }) {
        tracedEvaluationCount(timeRange: $timeRange)
        costSummary(timeRange: $timeRange) {
          total {
            cost
          }
          prompt {
            cost
          }
          completion {
            cost
          }
        }
      }
    `,
    projectEvaluator
  );
  const { costSummary, tracedEvaluationCount } = cost;
  const deferredError = useEvaluatorDeferredError();
  if (costSummary === undefined) {
    return deferredError != null ? (
      <TextErrorBoundaryFallback error="Cost failed to load." />
    ) : (
      <ProjectEvaluatorCostCellSkeleton />
    );
  }
  if (measure === "average") {
    return (
      <EvaluatorAverageCost
        evaluatorKind={evaluatorKind}
        costSummary={costSummary}
        runCount={tracedEvaluationCount}
      />
    );
  }
  return (
    <EvaluatorCost evaluatorKind={evaluatorKind} costSummary={costSummary} />
  );
}

const costSkeletonCSS = css`
  display: flex;
  justify-content: flex-end;
`;

function ProjectEvaluatorCostCellSkeleton() {
  return (
    <div css={costSkeletonCSS} aria-busy="true" aria-label="Loading cost">
      <Skeleton width={56} height={16} />
    </div>
  );
}
