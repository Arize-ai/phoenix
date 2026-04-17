import type { NoteMutationResult } from "./noteMutationUtils";

export type OutputFormat = "pretty" | "json" | "raw";

export interface FormatNoteMutationOutputOptions {
  note: NoteMutationResult;
  format?: OutputFormat;
}

export function formatNoteMutationOutput({
  note,
  format,
}: FormatNoteMutationOutputOptions): string {
  const selectedFormat = format || "pretty";
  if (selectedFormat === "raw") {
    return JSON.stringify(note);
  }
  if (selectedFormat === "json") {
    return JSON.stringify(note, null, 2);
  }
  return formatNoteMutationPretty(note);
}

function formatNoteMutationPretty(note: NoteMutationResult): string {
  return [
    "Note added",
    `  ID: ${note.id}`,
    `  Target: ${note.targetType} ${note.targetId}`,
    `  Text: ${note.text}`,
    `  Annotator: ${note.annotatorKind}`,
  ].join("\n");
}
