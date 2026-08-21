import type { ComponentType } from "react";
import { memo } from "react";

import { Flex, useTimeRange } from "@phoenix/components";
import type { AnnotationOptimizationConfig } from "@phoenix/components/annotation";
import { ChartPanel, DeferredChartPanel } from "@phoenix/components/chart";
import { useFrozenWhileHidden } from "@phoenix/hooks/useFrozenWhileHidden";
import type { MetricChartTableView } from "@phoenix/pages/project/constants";
import type { EvaluationTarget } from "@phoenix/pages/project/evaluators/__generated__/projectEvaluatorDetailsLoaderQuery.graphql";
import {
  metricsPanelsColumnCSS,
  metricsScrollContainerCSS,
} from "@phoenix/pages/project/metrics/metricsLayout";
import { DeferredProjectAnnotationMetricPanel } from "@phoenix/pages/project/metrics/ProjectAnnotationMetrics";
import { TraceCountTimeSeries } from "@phoenix/pages/project/metrics/TraceCountTimeSeries";
import { TraceLatencyPercentilesTimeSeries } from "@phoenix/pages/project/metrics/TraceLatencyPercentilesTimeSeries";
import { TraceTokenCostTimeSeries } from "@phoenix/pages/project/metrics/TraceTokenCostTimeSeries";
import type { EvaluatorScopedProjectMetricViewProps } from "@phoenix/pages/project/metrics/types";
import { useClosedTimeRange } from "@phoenix/pages/project/metrics/useClosedTimeRange";

import type { useProjectEvaluatorOutputConfigFragment$key } from "./__generated__/useProjectEvaluatorOutputConfigFragment.graphql";
import { useProjectEvaluatorOutputConfig } from "./useProjectEvaluatorOutputConfig";

type ProjectEvaluatorMetricsProps = {
  projectEvaluatorId: string;
  /** The project whose spans or sessions this evaluator annotates. */
  evaluatedProjectId: string;
  /** The evaluator's own trace project, minted when the evaluator is created. */
  traceProjectId: string;
  /** The evaluator's results are annotations carrying its name. */
  evaluatorName: string;
  evaluationTarget: EvaluationTarget;
  projectEvaluatorRef: useProjectEvaluatorOutputConfigFragment$key;
};

type EvaluatorTraceChart = {
  title: string;
  subtitle: string;
  Component: ComponentType<EvaluatorScopedProjectMetricViewProps>;
};

/**
 * The charts drawn from the evaluator's own trace project, rendered in rows
 * of two.
 */
const EVALUATOR_TRACE_CHART_ROWS: EvaluatorTraceChart[][] = [
  [
    {
      title: "Evaluations",
      subtitle: "Evaluation runs over time by status",
      Component: TraceCountTimeSeries,
    },
    {
      title: "Evaluation latency",
      subtitle: "Latency percentiles of evaluation runs",
      Component: TraceLatencyPercentilesTimeSeries,
    },
  ],
  [
    {
      title: "Evaluation cost",
      subtitle: "Estimated LLM cost of evaluation runs in USD",
      Component: TraceTokenCostTimeSeries,
    },
  ],
];

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
      return "spans";
  }
}

/**
 * The metrics tab of the project evaluator details page: how the evaluator's
 * results are trending on the evaluated project, and what its own runs cost
 * and how long they take, read from its own trace project scoped to this
 * evaluator.
 */
export function ProjectEvaluatorMetrics({
  projectEvaluatorRef,
  ...props
}: ProjectEvaluatorMetricsProps) {
  const timeRange = useClosedTimeRange();
  const { setCustomTimeRange } = useTimeRange();
  // The evaluated project has no annotation config for this evaluator's name,
  // so the results chart takes its optimization metadata from the evaluator.
  const annotationConfig = useProjectEvaluatorOutputConfig(projectEvaluatorRef);
  return (
    <div css={metricsScrollContainerCSS}>
      <ProjectEvaluatorMetricPanels
        {...props}
        annotationConfig={annotationConfig}
        timeRange={timeRange}
        onTimeRangeSelected={setCustomTimeRange}
      />
    </div>
  );
}

const ProjectEvaluatorMetricPanels = memo(
  function ProjectEvaluatorMetricPanels({
    projectEvaluatorId,
    evaluatedProjectId,
    traceProjectId,
    evaluatorName,
    evaluationTarget,
    annotationConfig,
    timeRange,
    onTimeRangeSelected,
  }: Omit<ProjectEvaluatorMetricsProps, "projectEvaluatorRef"> & {
    annotationConfig?: AnnotationOptimizationConfig;
    timeRange: TimeRange;
    onTimeRangeSelected: (timeRange: TimeRange) => void;
  }) {
    return (
      <div css={metricsPanelsColumnCSS}>
        <Flex direction="row" gap="size-200">
          <DeferredProjectAnnotationMetricPanel
            projectId={evaluatedProjectId}
            annotationLevel={getAnnotationLevel(evaluationTarget)}
            annotationName={evaluatorName}
            annotationConfig={annotationConfig}
            title="Evaluation Results"
            subtitle="Scores and labels produced over time"
            timeRange={timeRange}
            onTimeRangeSelected={onTimeRangeSelected}
          />
        </Flex>
        {EVALUATOR_TRACE_CHART_ROWS.map((row) => (
          <Flex key={row[0].title} direction="row" gap="size-200">
            {row.map((chart) => (
              <DeferredEvaluatorTracePanel
                key={chart.title}
                chart={chart}
                traceProjectId={traceProjectId}
                projectEvaluatorId={projectEvaluatorId}
                timeRange={timeRange}
                onTimeRangeSelected={onTimeRangeSelected}
              />
            ))}
          </Flex>
        ))}
      </div>
    );
  }
);

type EvaluatorTracePanelProps = {
  chart: EvaluatorTraceChart;
  traceProjectId: string;
  projectEvaluatorId: string;
  timeRange: TimeRange;
  onTimeRangeSelected: (timeRange: TimeRange) => void;
};

/** A deferred panel over one of the evaluator's own-trace charts. */
function DeferredEvaluatorTracePanel({
  chart,
  ...props
}: EvaluatorTracePanelProps) {
  return (
    <DeferredChartPanel title={chart.title} subtitle={chart.subtitle}>
      <EvaluatorTracePanelWithFrozenTimeRange {...props} chart={chart} />
    </DeferredChartPanel>
  );
}

// Split out so useFrozenWhileHidden runs inside the deferred panel's
// visibility context: the time range is a query variable, and a live range
// advancing while the chart is hidden would refetch data the user can't see.
function EvaluatorTracePanelWithFrozenTimeRange({
  chart,
  traceProjectId,
  projectEvaluatorId,
  timeRange,
  onTimeRangeSelected,
}: EvaluatorTracePanelProps) {
  const visibleTimeRange = useFrozenWhileHidden(timeRange);
  return (
    <ChartPanel title={chart.title} subtitle={chart.subtitle}>
      <chart.Component
        projectId={traceProjectId}
        projectEvaluatorId={projectEvaluatorId}
        timeRange={visibleTimeRange}
        onTimeRangeSelected={onTimeRangeSelected}
      />
    </ChartPanel>
  );
}
