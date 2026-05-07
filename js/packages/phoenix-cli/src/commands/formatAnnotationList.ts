import { formatTable } from "./formatTable";

export type OutputFormat = "pretty" | "json" | "raw";

/**
 * Shape covering the union of `SpanAnnotation`, `TraceAnnotation`, and
 * `SessionAnnotation` returned by the project-scoped `*_annotations`
 * endpoints. We type the formatter loosely so all three resources can share
 * a single implementation without having to reach for a discriminated union.
 */
export type AnnotationListItem = {
  id: string;
  name: string;
  annotator_kind?: string | null;
  identifier?: string | null;
  result?: {
    label?: string | null;
    score?: number | null;
    explanation?: string | null;
  } | null;
  // Per-target id — exactly one is set depending on the resource.
  span_id?: string;
  trace_id?: string;
  session_id?: string;
  [key: string]: unknown;
};

export type AnnotationListTarget = "trace" | "span" | "session";

export interface FormatAnnotationListOutputOptions {
  /**
   * Annotations to format. Tolerant of unset / missing fields per
   * `gotchas/tooling/px-span-list-include-annotations-returns-spans-whe`.
   */
  annotations: AnnotationListItem[];
  /**
   * The resource the listing was made against. Used to pick the per-row
   * target id for pretty-mode rendering.
   */
  target: AnnotationListTarget;
  /**
   * Output format. Defaults to `"pretty"`.
   */
  format?: OutputFormat;
}

export function formatAnnotationListOutput({
  annotations,
  target,
  format,
}: FormatAnnotationListOutputOptions): string {
  const selected = format || "pretty";
  if (selected === "raw") {
    // Raw emits the unwrapped array per D6.
    return JSON.stringify(annotations);
  }
  if (selected === "json") {
    // JSON mode wraps as { annotations: [...] } per D6 — mirrors the
    // `formatProfilesOutput` array convention.
    return JSON.stringify({ annotations }, null, 2);
  }
  return formatAnnotationListPretty({ annotations, target });
}

function targetIdFor(
  annotation: AnnotationListItem,
  target: AnnotationListTarget
): string {
  if (target === "trace") return annotation.trace_id ?? "";
  if (target === "span") return annotation.span_id ?? "";
  return annotation.session_id ?? "";
}

function formatAnnotationListPretty({
  annotations,
  target,
}: {
  annotations: AnnotationListItem[];
  target: AnnotationListTarget;
}): string {
  if (annotations.length === 0) {
    return `No ${target} annotations found.`;
  }
  const targetIdHeader = `${target}_id`;
  const rows = annotations.map((annotation) => ({
    id: annotation.id,
    name: annotation.name,
    label: annotation.result?.label ?? "",
    score:
      annotation.result?.score === undefined ||
      annotation.result?.score === null
        ? ""
        : String(annotation.result.score),
    identifier: annotation.identifier ?? "",
    annotator_kind: annotation.annotator_kind ?? "",
    [targetIdHeader]: targetIdFor(annotation, target),
  }));
  return formatTable(rows);
}
