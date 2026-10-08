import type { ProjectEvaluatorResultAnnotation } from "@phoenix/hooks/useProjectEvaluatorResultAnnotations";
import type { MetricChartTableView } from "@phoenix/pages/project/constants";
import { DeferredProjectAnnotationMetricPanel } from "@phoenix/pages/project/metrics/ProjectAnnotationMetrics";

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
