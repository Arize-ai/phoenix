import type { MetricChartTableView } from "@phoenix/pages/project/constants";
import type { ProjectEvaluatorResultAnnotation } from "@phoenix/pages/project/evaluators/useProjectEvaluatorResultAnnotations";
import {
  DeferredProjectMetricPanel,
  getProjectMetricChart,
} from "@phoenix/pages/project/metrics/chartCatalog";
import { DeferredProjectAnnotationMetricPanel } from "@phoenix/pages/project/metrics/ProjectAnnotationMetrics";

/**
 * The panels that chart a project evaluator, shared by the overview stats
 * strip and the Metrics tab so the two surfaces cannot drift. Callers supply
 * layout (`fillHeight`) and, where warranted, a title.
 */

type EvaluatorTraceMetricPanelProps = {
  /** The evaluator's own trace project, which holds one trace per run. */
  traceProjectId: string;
  timeRange: TimeRange;
  onTimeRangeSelected?: (timeRange: TimeRange) => void;
  fillHeight?: boolean;
};

/** Evaluation run volume by status, read from the evaluator's trace project. */
export function EvaluatorRunsMetricPanel({
  traceProjectId,
  ...props
}: EvaluatorTraceMetricPanelProps) {
  return (
    <DeferredProjectMetricPanel
      chart={getProjectMetricChart("traces")}
      title="Evaluations"
      subtitle="Evaluation runs over time by status"
      projectId={traceProjectId}
      {...props}
    />
  );
}

/** Latency percentiles of the evaluator's runs. */
export function EvaluatorLatencyMetricPanel({
  traceProjectId,
  ...props
}: EvaluatorTraceMetricPanelProps) {
  return (
    <DeferredProjectMetricPanel
      chart={getProjectMetricChart("latency")}
      title="Evaluation latency"
      subtitle="Latency percentiles of evaluation runs"
      projectId={traceProjectId}
      {...props}
    />
  );
}

/** What the evaluator's LLM runs cost. */
export function EvaluatorCostMetricPanel({
  traceProjectId,
  title = "Evaluation cost",
  ...props
}: EvaluatorTraceMetricPanelProps & { title?: string }) {
  return (
    <DeferredProjectMetricPanel
      chart={getProjectMetricChart("cost")}
      title={title}
      subtitle="Estimated LLM cost of evaluation runs in USD"
      projectId={traceProjectId}
      {...props}
    />
  );
}

/**
 * How one of the evaluator's result annotations is trending on the evaluated
 * project, with optimization metadata read from the evaluator (the project
 * has no annotation config for it).
 */
export function EvaluatorResultAnnotationMetricPanel({
  evaluatedProjectId,
  annotationLevel,
  annotation,
  title,
  ...props
}: {
  /** The project whose spans, traces, or sessions this evaluator annotates. */
  evaluatedProjectId: string;
  annotationLevel: MetricChartTableView;
  /** The annotation the evaluator writes, named the way its runs persist it. */
  annotation: ProjectEvaluatorResultAnnotation;
  title: string;
  timeRange: TimeRange;
  onTimeRangeSelected?: (timeRange: TimeRange) => void;
  fillHeight?: boolean;
}) {
  return (
    <DeferredProjectAnnotationMetricPanel
      projectId={evaluatedProjectId}
      annotationLevel={annotationLevel}
      annotationName={annotation.name}
      annotationConfig={annotation.config}
      title={title}
      subtitle="Scores and labels produced over time"
      {...props}
    />
  );
}
