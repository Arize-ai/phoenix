import type { AnnotationMutationResult } from "./annotationMutationUtils";

export type OutputFormat = "pretty" | "json" | "raw";

export interface FormatAnnotationMutationOutputOptions {
  annotation: AnnotationMutationResult;
  format?: OutputFormat;
}

export function formatAnnotationMutationOutput({
  annotation,
  format,
}: FormatAnnotationMutationOutputOptions): string {
  const selectedFormat = format || "pretty";
  if (selectedFormat === "raw") {
    return JSON.stringify(annotation);
  }
  if (selectedFormat === "json") {
    return JSON.stringify(annotation, null, 2);
  }
  return formatAnnotationMutationPretty(annotation);
}

function formatAnnotationMutationPretty(
  annotation: AnnotationMutationResult
): string {
  return [
    "Annotation upserted",
    `  ID: ${annotation.id}`,
    `  Target: ${annotation.targetType} ${annotation.targetId}`,
    `  Name: ${annotation.name}`,
    `  Label: ${annotation.label ?? "n/a"}`,
    `  Score: ${annotation.score ?? "n/a"}`,
    `  Explanation: ${annotation.explanation ?? "n/a"}`,
    `  Annotator: ${annotation.annotatorKind}`,
    `  Identifier: ${annotation.identifier || '""'}`,
  ].join("\n");
}
