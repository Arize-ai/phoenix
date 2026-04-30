import type { paths } from "../__generated__/api/v1";
import type { Annotation, AnnotationResult } from "../types/annotations";

type TraceAnnotationData =
  paths["/v1/trace_annotations"]["post"]["requestBody"]["content"]["application/json"]["data"][0];

/**
 * Parameters for a single trace annotation
 */
export interface TraceAnnotation extends Annotation {
  /**
   * The OpenTelemetry Trace ID (hex format without 0x prefix)
   */
  traceId: string;
  /**
   * The kind of annotator used for the annotation
   * Can be "HUMAN", "LLM", or "CODE"
   * @default "HUMAN"
   */
  annotatorKind?: TraceAnnotationData["annotator_kind"];
}

/**
 * Build and validate annotation result fields
 */
function buildTraceAnnotationResult(
  annotation: Pick<TraceAnnotation, "label" | "score" | "explanation">
): AnnotationResult {
  const result: AnnotationResult = {};

  if (annotation.label !== undefined) {
    result.label = annotation.label.trim() || null;
  }
  if (annotation.score !== undefined) {
    result.score = annotation.score;
  }
  if (annotation.explanation !== undefined) {
    result.explanation = annotation.explanation.trim() || null;
  }

  const hasValidResult =
    result.label || result.score !== undefined || result.explanation;
  if (!hasValidResult) {
    throw new Error(
      "At least one of label, score, or explanation must be provided for trace annotation"
    );
  }
  return result;
}

/**
 * Convert a TraceAnnotation to the API format
 */
export function toTraceAnnotationData(
  annotation: TraceAnnotation
): TraceAnnotationData {
  if (annotation.name.trim() === "note") {
    throw new Error(
      'The name "note" is reserved for trace and span notes. Use addTraceNote instead.'
    );
  }
  const result = buildTraceAnnotationResult(annotation);

  return {
    trace_id: annotation.traceId.trim(),
    name: annotation.name.trim(),
    annotator_kind: annotation.annotatorKind ?? "HUMAN",
    result,
    metadata: annotation.metadata ?? null,
    identifier: annotation.identifier?.trim() ?? "",
  };
}
