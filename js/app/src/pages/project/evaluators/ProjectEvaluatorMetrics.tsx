import { memo } from "react";
import { graphql, useFragment } from "react-relay";

import { Flex, useTimeRange } from "@phoenix/components";
import type { MetricChartTableView } from "@phoenix/pages/project/constants";
import {
  DeferredProjectMetricPanel,
  getProjectMetricChart,
} from "@phoenix/pages/project/metrics/chartCatalog";
import {
  metricsPanelsColumnCSS,
  metricsScrollContainerCSS,
} from "@phoenix/pages/project/metrics/metricsLayout";
import { DeferredProjectAnnotationMetricPanel } from "@phoenix/pages/project/metrics/ProjectAnnotationMetrics";
import { useClosedTimeRange } from "@phoenix/pages/project/metrics/useClosedTimeRange";
import { assertUnreachable } from "@phoenix/typeUtils";

import type {
  EvaluationTarget,
  ProjectEvaluatorMetrics_projectEvaluator$key,
} from "./__generated__/ProjectEvaluatorMetrics_projectEvaluator.graphql";
import type { ProjectEvaluatorResultAnnotation } from "./useProjectEvaluatorResultAnnotations";
import { useProjectEvaluatorResultAnnotations } from "./useProjectEvaluatorResultAnnotations";

/**
 * The evaluator's result annotations live at the level its target selects on
 * the evaluated project. TRACE evaluators are stored but never scheduled, so
 * an empty trace-level chart is the honest reading for them.
 */
function getAnnotationLevel(
  evaluationTarget: EvaluationTarget
): MetricChartTableView {
  switch (evaluationTarget) {
    case "SPAN":
      return "spans";
    case "SESSION":
      return "sessions";
    case "TRACE":
      return "traces";
    default:
      return assertUnreachable(evaluationTarget);
  }
}

/**
 * The metrics tab of the project evaluator details page: how the evaluator's
 * results are trending on the evaluated project, and what its own runs cost
 * and how long they take, read from its own trace project.
 */
export function ProjectEvaluatorMetrics({
  projectEvaluator,
}: {
  projectEvaluator: ProjectEvaluatorMetrics_projectEvaluator$key;
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
  const timeRange = useClosedTimeRange();
  const { setCustomTimeRange } = useTimeRange();
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
        onTimeRangeSelected={setCustomTimeRange}
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
      projectId: traceProjectId,
      timeRange,
      onTimeRangeSelected,
    };
    return (
      <div css={metricsPanelsColumnCSS}>
        <Flex direction="row" gap="size-200">
          {resultAnnotations.map((annotation) => (
            <DeferredProjectAnnotationMetricPanel
              key={annotation.name}
              projectId={evaluatedProjectId}
              annotationLevel={annotationLevel}
              annotationName={annotation.name}
              annotationConfig={annotation.config}
              // A lone result annotation needs no name to tell it apart.
              title={
                resultAnnotations.length > 1
                  ? annotation.name
                  : "Evaluation Results"
              }
              subtitle="Scores and labels produced over time"
              timeRange={timeRange}
              onTimeRangeSelected={onTimeRangeSelected}
            />
          ))}
        </Flex>
        <Flex direction="row" gap="size-200">
          <DeferredProjectMetricPanel
            chart={getProjectMetricChart("traces")}
            title="Evaluations"
            subtitle="Evaluation runs over time by status"
            {...evaluatorTraceChartProps}
          />
          <DeferredProjectMetricPanel
            chart={getProjectMetricChart("latency")}
            title="Evaluation latency"
            subtitle="Latency percentiles of evaluation runs"
            {...evaluatorTraceChartProps}
          />
        </Flex>
        <Flex direction="row" gap="size-200">
          <DeferredProjectMetricPanel
            chart={getProjectMetricChart("cost")}
            title="Evaluation cost"
            subtitle="Estimated LLM cost of evaluation runs in USD"
            {...evaluatorTraceChartProps}
          />
        </Flex>
      </div>
    );
  }
);
