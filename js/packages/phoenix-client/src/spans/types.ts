import { paths } from "../__generated__/api/v1";

type SpanAnnotationData =
  paths["/v1/span_annotations"]["post"]["requestBody"]["content"]["application/json"]["data"][0];

/**
 * Parameters for a single span annotation
 */
export interface SpanAnnotation {
  /**
   * The OpenTelemetry Span ID (hex format without 0x prefix)
   */
  spanId: string;
  /**
   * The name of the annotation
   */
  name: string;
  /**
   * The label assigned by the annotation
   */
  label?: string;
  /**
   * The score assigned by the annotation
   */
  score?: number;
  /**
   * The identifier of the annotation. If provided, the annotation will be updated if it already exists.
   */
  identifier?: string;
  /**
   * Metadata for the annotation
   */
  metadata?: Record<string, unknown>;
  /**
   * The kind of annotator used for the annotation
   * Can be "HUMAN", "LLM", or "CODE"
   * @default "HUMAN"
   */
  annotatorKind?: SpanAnnotationData["annotator_kind"];
}

/**
 * Convert a SpanAnnotation to the API format
 */
export function toSpanAnnotationData(
  annotation: SpanAnnotation
): SpanAnnotationData {
  return {
    span_id: annotation.spanId,
    name: annotation.name,
    annotator_kind: annotation.annotatorKind ?? "HUMAN",
    result: {
      label: annotation.label ?? null,
      score: annotation.score ?? null,
      explanation: null,
    },
    metadata: annotation.metadata ?? null,
    identifier: annotation.identifier ?? "",
  };
}
