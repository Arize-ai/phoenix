import type { components } from "@phoenix/api/__generated__/v1";

export type AnnotatorKind =
  components["schemas"]["SpanAnnotationData"]["annotator_kind"];

export const ANNOTATOR_KINDS = [
  "LLM",
  "HUMAN",
  "CODE",
] as const satisfies readonly AnnotatorKind[];

/**
 * Hotkey that focuses the annotation editor.
 */
export const EDIT_ANNOTATION_HOTKEY = "e";

/**
 * Hotkey that opens the span note bar and focuses its input.
 */
export const NOTE_HOTKEY = "n";

/**
 * The reserved annotation name a note is recorded under. Views that show one
 * filter out the other.
 */
export const NOTE_ANNOTATION_NAME = "note";
