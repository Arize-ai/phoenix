/**
 * Deduplicates annotations by name by keeping the latest one
 */
export const deduplicateAnnotationsByName = <
  T extends { name: string; createdAt: string },
>(
  annotations: T[]
) => {
  return Object.values(
    annotations.reduce<Record<string, T>>((acc, annotation) => {
      if (!acc[annotation.name]) {
        acc[annotation.name] = annotation;
      } else if (
        new Date(acc[annotation.name].createdAt) <
        new Date(annotation.createdAt)
      ) {
        acc[annotation.name] = annotation;
      }
      return acc;
    }, {})
  );
};
