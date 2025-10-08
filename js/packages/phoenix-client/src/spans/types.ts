import { paths } from "../__generated__/api/v1";
import { Annotation } from "../types/annotations";

type SpanAnnotationData =
  paths["/v1/span_annotations"]["post"]["requestBody"]["content"]["application/json"]["data"][0];

type SpanDocumentAnnotationData =
  paths["/v1/document_annotations"]["post"]["requestBody"]["content"]["application/json"]["data"][0];

/**
 * Parameters for a single span annotation
 */
export interface SpanAnnotation extends Annotation {
  /**
   * The OpenTelemetry Span ID (hex format without 0x prefix)
   */
  spanId: string;
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
export interface DocumentAnnotation extends SpanAnnotation {
  /**
   * The 0-based index of the document within the span
   */
  documentPosition: number;
  /**
   * The kind of annotator used for the annotation
   * Can be "HUMAN", "LLM", or "CODE"
   * @default "HUMAN"
   */
  annotatorKind?: SpanDocumentAnnotationData["annotator_kind"];
}

type AnnotationResult = {
  label?: string | null;
  score?: number | null;
  explanation?: string | null;
};

/**
 * Build and validate annotation result fields
 */
function buildAnnotationResult(
  annotation: Pick<
    SpanAnnotation | DocumentAnnotation,
    "label" | "score" | "explanation"
  >,
  annotationType: "span" | "document"
): AnnotationResult {
  const result: AnnotationResult = {};

  // Build result with trimming for string fields
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
  const hasValidResult =
    result.label || result.score !== undefined || result.explanation;
  if (!hasValidResult) {
    throw new Error(
      `At least one of label, score, or explanation must be provided for ${annotationType} annotation`
    );
  }

  return result;
}

/**
 * Convert a SpanAnnotation to the API format
 */
export function toSpanAnnotationData(
  annotation: SpanAnnotation
): SpanAnnotationData {
  const result = buildAnnotationResult(annotation, "span");

  return {
    span_id: annotation.spanId.trim(),
    name: annotation.name.trim(),
    annotator_kind: annotation.annotatorKind ?? "HUMAN",
    result,
    metadata: annotation.metadata ?? null,
    identifier: annotation.identifier?.trim() ?? "",
  };
}

/**
 * Convert a DocumentAnnotation to the API format
 */
export function toDocumentAnnotationData(
  annotation: DocumentAnnotation
): SpanDocumentAnnotationData {
  const result = buildAnnotationResult(annotation, "document");

  return {
    span_id: annotation.spanId.trim(),
    document_position: annotation.documentPosition,
    name: annotation.name.trim(),
    annotator_kind: annotation.annotatorKind ?? "HUMAN",
    result,
    metadata: annotation.metadata ?? null,
  };
}
