type AnnotationVisibilityMap = Partial<Record<string, boolean>>;

export function getNonNoteAnnotationNames(
  spanAnnotationNames: ReadonlyArray<string>
) {
  return spanAnnotationNames.filter((name) => name !== "note");
}

/**
 * Returns the span annotation names that should render dynamic columns,
 * preserving the server-provided annotation order.
 */
export function getVisibleSpanAnnotationColumnNames({
  spanAnnotationNames,
  annotationVisibility,
}: {
  spanAnnotationNames: ReadonlyArray<string>;
  annotationVisibility: AnnotationVisibilityMap;
}) {
  return getNonNoteAnnotationNames(spanAnnotationNames).filter(
    (name) => annotationVisibility[name]
  );
}
