import { paths } from "../__generated__/api/v1";
import { Annotation, AnnotationResult } from "../types/annotations";

type SessionAnnotationData =
  paths["/v1/session_annotations"]["post"]["requestBody"]["content"]["application/json"]["data"][0];

/**
 * Parameters for a single session annotation
 */
export interface SessionAnnotation extends Annotation {
  /*
   * The session ID used to track a conversation, thread, or session
   */
  sessionId: string;
  /**
   * The entity that performed the annotation
   */
  annotatorKind?: SessionAnnotationData["annotator_kind"];
}

/**
 * Build and validate annotation result fields
 */
function buildSessionAnnotationResult(
  annotation: Pick<SessionAnnotation, "label" | "score" | "explanation">
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
      `At least one of label, score, or explanation must be provided for session annotation`
    );
  }
  return result;
}

/**
 * Convert a SessionAnnotation to the API format
 */
export function toSessionAnnotationData(
  annotation: SessionAnnotation
): SessionAnnotationData {
  const result = buildSessionAnnotationResult(annotation);

  return {
    session_id: annotation.sessionId.trim(),
    name: annotation.name.trim(),
    annotator_kind: annotation.annotatorKind ?? "HUMAN",
    result,
    metadata: annotation.metadata ?? null,
    identifier: annotation.identifier?.trim() ?? "",
  };
}
