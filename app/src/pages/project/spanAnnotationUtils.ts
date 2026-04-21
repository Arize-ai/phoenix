type AnnotationColumnVisibility = Partial<Record<string, boolean>>;

export function getFilteredSpanAnnotationNames(
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
  annotationColumnVisibility,
}: {
  spanAnnotationNames: ReadonlyArray<string>;
  annotationColumnVisibility: AnnotationColumnVisibility;
}) {
  return getFilteredSpanAnnotationNames(spanAnnotationNames).filter(
    (name) => annotationColumnVisibility[name]
  );
}
