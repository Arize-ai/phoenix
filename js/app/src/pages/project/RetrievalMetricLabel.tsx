import { AnnotationLabel } from "@phoenix/components/annotation/AnnotationLabel";
import type {
  Annotation,
  AnnotationDisplayPreference,
} from "@phoenix/components/annotation/types";

interface RetrievalMetricLabelProps {
  name?: string;
  metric: "ndcg" | "precision" | "hit" | "hit rate";
  k?: number | null;
  score?: number | null;
}

/**
 * Adapts a document retrieval metric to the shared annotation-label treatment.
 * Retrieval metrics are not annotation records, but they use the same compact
 * name-and-value presentation throughout trace and project surfaces.
 */
export function RetrievalMetricLabel({
  name,
  metric,
  k,
  score,
}: RetrievalMetricLabelProps) {
  const metricName = typeof k === "number" ? `${metric}@${k}` : metric;
  const annotationName = name ? `${name} ${metricName}` : metricName;
  const isBooleanMetric = metric === "hit";
  const hasNumericScore = typeof score === "number";

  let annotation: Annotation;
  let annotationDisplayPreference: AnnotationDisplayPreference;

  if (isBooleanMetric) {
    annotation = { name: annotationName, label: score ? "true" : "false" };
    annotationDisplayPreference = "label";
  } else if (hasNumericScore) {
    annotation = { name: annotationName, score };
    annotationDisplayPreference = "score";
  } else {
    annotation = { name: annotationName, label: "--" };
    annotationDisplayPreference = "label";
  }

  return (
    <AnnotationLabel
      annotation={annotation}
      annotationDisplayPreference={annotationDisplayPreference}
    />
  );
}
