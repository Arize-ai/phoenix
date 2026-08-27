import { memo } from "react";
import { graphql, useFragment } from "react-relay";

import { Flex } from "@phoenix/components";
import type { MetricChartTableView } from "@phoenix/pages/project/constants";
import {
  EvaluatorCostMetricPanel,
  EvaluatorLatencyMetricPanel,
  EvaluatorResultAnnotationMetricPanel,
  EvaluatorRunsMetricPanel,
} from "@phoenix/pages/project/evaluators/projectEvaluatorMetricPanels";
import { getAnnotationLevel } from "@phoenix/pages/project/evaluators/projectEvaluatorTypes";
import {
  metricsPanelsColumnCSS,
  metricsScrollContainerCSS,
} from "@phoenix/pages/project/metrics/metricsLayout";

import type { ProjectEvaluatorMetrics_projectEvaluator$key } from "./__generated__/ProjectEvaluatorMetrics_projectEvaluator.graphql";
import type { ProjectEvaluatorResultAnnotation } from "./useProjectEvaluatorResultAnnotations";
import { useProjectEvaluatorResultAnnotations } from "./useProjectEvaluatorResultAnnotations";

/**
 * The metrics tab of the project evaluator details page: how the evaluator's
 * results are trending on the evaluated project, and what its own runs cost
 * and how long they take, read from its own trace project.
 */
export function ProjectEvaluatorMetrics({
  projectEvaluator,
  timeRange,
  onTimeRangeSelected,
}: {
  projectEvaluator: ProjectEvaluatorMetrics_projectEvaluator$key;
  timeRange: TimeRange;
  onTimeRangeSelected: (timeRange: TimeRange) => void;
}) {
  const data = useFragment(
    graphql`
      fragment ProjectEvaluatorMetrics_projectEvaluator on ProjectEvaluator {
        evaluationTarget
        project {
          id
        }
        traceProject {
          id
        }
        ...useProjectEvaluatorResultAnnotationsFragment
      }
    `,
    projectEvaluator
  );
  // The evaluated project has no annotation configs for this evaluator's
  // results, so the results charts take their names and optimization metadata
  // from the evaluator.
  const resultAnnotations = useProjectEvaluatorResultAnnotations(data);
  return (
    <div css={metricsScrollContainerCSS}>
      <ProjectEvaluatorMetricPanels
        evaluatedProjectId={data.project.id}
        traceProjectId={data.traceProject.id}
        annotationLevel={getAnnotationLevel(data.evaluationTarget)}
        resultAnnotations={resultAnnotations}
        timeRange={timeRange}
        onTimeRangeSelected={onTimeRangeSelected}
      />
    </div>
  );
}

const ProjectEvaluatorMetricPanels = memo(
  function ProjectEvaluatorMetricPanels({
    evaluatedProjectId,
    traceProjectId,
    annotationLevel,
    resultAnnotations,
    timeRange,
    onTimeRangeSelected,
  }: {
    /** The project whose spans or sessions this evaluator annotates. */
    evaluatedProjectId: string;
    /** The evaluator's own trace project, minted when the evaluator is created. */
    traceProjectId: string;
    annotationLevel: MetricChartTableView;
    /** The annotations the evaluator writes, named the way its runs persist them. */
    resultAnnotations: ReadonlyArray<ProjectEvaluatorResultAnnotation>;
    timeRange: TimeRange;
    onTimeRangeSelected: (timeRange: TimeRange) => void;
  }) {
    const evaluatorTraceChartProps = {
      traceProjectId,
      timeRange,
      onTimeRangeSelected,
    };
    return (
      <div css={metricsPanelsColumnCSS}>
        <Flex direction="row" gap="size-200">
          {resultAnnotations.map((annotation) => (
            <EvaluatorResultAnnotationMetricPanel
              key={annotation.name}
              evaluatedProjectId={evaluatedProjectId}
              annotationLevel={annotationLevel}
              annotation={annotation}
              // A lone result annotation needs no name to tell it apart.
              title={
                resultAnnotations.length > 1
                  ? annotation.name
                  : "Evaluation Results"
              }
              timeRange={timeRange}
              onTimeRangeSelected={onTimeRangeSelected}
            />
          ))}
        </Flex>
        <Flex direction="row" gap="size-200">
          <EvaluatorRunsMetricPanel {...evaluatorTraceChartProps} />
          <EvaluatorLatencyMetricPanel {...evaluatorTraceChartProps} />
        </Flex>
        <Flex direction="row" gap="size-200">
          <EvaluatorCostMetricPanel {...evaluatorTraceChartProps} />
        </Flex>
      </div>
    );
  }
);
