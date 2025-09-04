import { paths } from "../__generated__/api/v1";

type SpanAnnotationData =
  paths["/v1/span_annotations"]["post"]["requestBody"]["content"]["application/json"]["data"][0];

type SpanDocumentAnnotationData =
  paths["/v1/document_annotations"]["post"]["requestBody"]["content"]["application/json"]["data"][0];

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
 * Parameters for a single document annotation
 */
export interface DocumentAnnotation {
  /**
   * The OpenTelemetry Span ID (hex format without 0x prefix)
   */
  spanId: string;
  /**
   * The 0-based index of the document within the span
   */
  documentPosition: number;
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
   * Explanation of the annotation result
   */
  explanation?: string;
  /**
   * Metadata for the annotation
   */
  metadata?: Record<string, unknown>;
  /**
   * The kind of annotator used for the annotation
   * Can be "HUMAN", "LLM", or "CODE"
   * @default "HUMAN"
   */
  annotatorKind?: SpanDocumentAnnotationData["annotator_kind"];
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

/**
 * Convert a DocumentAnnotation to the API format
 */
export function toDocumentAnnotationData(
  annotation: DocumentAnnotation
): SpanDocumentAnnotationData {
  // At least one of label, score, or explanation must be provided
  const result: {
    label?: string | null;
    score?: number | null;
    explanation?: string | null;
  } = {};

  if (annotation.label !== undefined) {
    result.label = annotation.label.trim() || null;
  }
  if (annotation.score !== undefined) {
    result.score = annotation.score;
  }
  if (annotation.explanation !== undefined) {
    result.explanation = annotation.explanation.trim() || null;
  }

  // Validate that at least one result field is provided
  if (!result.label && result.score === undefined && !result.explanation) {
    throw new Error(
      "At least one of label, score, or explanation must be provided for document annotation"
    );
  }

  return {
    span_id: annotation.spanId,
    document_position: annotation.documentPosition,
    name: annotation.name,
    annotator_kind: annotation.annotatorKind ?? "HUMAN",
    result,
    metadata: annotation.metadata ?? null,
  };
}
