import type { Annotation } from "./types";

/** Whether an annotation has a value that can be represented by a summary token. */
export function hasAnnotationValue(
  annotation: Pick<Annotation, "label" | "score">
) {
  return annotation.label != null || annotation.score != null;
}
