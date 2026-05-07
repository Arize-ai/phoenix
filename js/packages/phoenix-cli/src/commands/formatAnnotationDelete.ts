export type OutputFormat = "pretty" | "json" | "raw";

export type AnnotationDeleteTarget = "trace" | "span" | "session";

export interface AnnotationDeleteFilter {
  identifier?: string;
  name?: string;
  annotator_kind?: "HUMAN" | "LLM" | "CODE";
  start_time?: string;
  end_time?: string;
  all?: boolean;
}

export interface AnnotationDeleteResult {
  deleted: true;
  target: AnnotationDeleteTarget;
  filter: AnnotationDeleteFilter;
}

export interface FormatAnnotationDeleteOutputOptions {
  result: AnnotationDeleteResult;
  format?: OutputFormat;
}

/**
 * Format the structured success record returned by `delete-annotations`.
 *
 * Per D7, every delete-annotations call returns a structured record that
 * echoes the *authorized* filter so downstream callers (and audit trails)
 * can distinguish `--all` from a bounded time-window delete without having
 * to re-derive it from CLI flags.
 */
export function formatAnnotationDeleteOutput({
  result,
  format,
}: FormatAnnotationDeleteOutputOptions): string {
  const selected = format || "pretty";
  if (selected === "raw") {
    return JSON.stringify(result);
  }
  if (selected === "json") {
    return JSON.stringify(result, null, 2);
  }
  return formatAnnotationDeletePretty(result);
}

function formatAnnotationDeletePretty(result: AnnotationDeleteResult): string {
  const filter = result.filter;
  const narrowers: string[] = [];
  if (filter.identifier !== undefined) {
    narrowers.push(`identifier=${filter.identifier}`);
  }
  if (filter.name !== undefined) {
    narrowers.push(`name=${filter.name}`);
  }
  if (filter.annotator_kind !== undefined) {
    narrowers.push(`annotator_kind=${filter.annotator_kind}`);
  }
  const narrowing = narrowers.length > 0 ? ` by ${narrowers.join(", ")}` : "";
  if (filter.all === true) {
    return `Deleted annotations for ${result.target}${narrowing} (delete_all=true).`;
  }
  return `Deleted annotations for ${result.target}${narrowing} between ${filter.start_time} and ${filter.end_time}.`;
}
