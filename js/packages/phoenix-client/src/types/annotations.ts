import { components } from "../__generated__/api/v1";

export type AnnotatorKind =
  components["schemas"]["SpanAnnotationData"]["annotator_kind"];

/**
 * The result of an annotation from an author (e.x. an LLM or human)
 */
export type AnnotationResult = {
  label?: string | null;
  score?: number | null;
  explanation?: string | null;
};

/**
 * The base interface for all kinds of annotations (span, trace, session)
 */
export interface Annotation {
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
   * The identifier of the annotation. If provided, the annotation will be updated if it already exists.
   */
  identifier?: string;
  /**
   * Metadata for the annotation
   */
  metadata?: Record<string, unknown>;
}
