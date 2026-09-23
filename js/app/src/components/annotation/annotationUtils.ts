import type { Annotation } from "./types";

/** Whether an annotation has a value that can be represented by a summary token. */
export function hasAnnotationValue(
  annotation: Pick<Annotation, "label" | "score">
) {
  return annotation.label != null || annotation.score != null;
}

/** Groups annotations by name and orders each group newest first. */
export function groupAnnotationsByName<
  TAnnotation extends { readonly name: string; readonly createdAt: string },
>(annotations: readonly TAnnotation[]): Partial<Record<string, TAnnotation[]>> {
  // Annotation names are user-defined, so avoid collisions with object keys
  // such as "constructor" and "__proto__".
  const annotationsByName = Object.create(null) as Partial<
    Record<string, TAnnotation[]>
  >;
  annotations.forEach((annotation) => {
    const annotationsForName = annotationsByName[annotation.name];
    if (annotationsForName == null) {
      annotationsByName[annotation.name] = [annotation];
    } else {
      annotationsForName.push(annotation);
    }
  });
  Object.values(annotationsByName).forEach((annotationsForName) => {
    annotationsForName?.sort((firstAnnotation, secondAnnotation) =>
      secondAnnotation.createdAt.localeCompare(firstAnnotation.createdAt)
    );
  });
  return annotationsByName;
}
