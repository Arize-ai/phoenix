import type { SpanAnnotation, SpanWithAnnotations } from "../trace";
import { formatTable } from "./formatTable";

export type OutputFormat = "pretty" | "json" | "raw";

export interface FormatSpansOutputOptions {
  spans: SpanWithAnnotations[];
  format?: OutputFormat;
}

export function formatSpansOutput({
  spans,
  format,
}: FormatSpansOutputOptions): string {
  const selected = format || "pretty";
  if (selected === "raw") {
    return JSON.stringify(spans);
  }
  if (selected === "json") {
    return JSON.stringify(spans, null, 2);
  }
  if (spans.length === 0) {
    return "No spans found";
  }
  return formatSpansPretty(spans);
}

function formatSpansPretty(spans: SpanWithAnnotations[]): string {
  const hasAnnotations = spans.some(
    (s) => s.annotations && s.annotations.length > 0
  );
  const hasNotes = spans.some((s) => s.notes && s.notes.length > 0);

  const rows = spans.map((span) => {
    const statusCode = span.status_code || "UNSET";
    const statusIcon = statusCode === "ERROR" ? "✗" : "✓";
    const row: Record<string, string> = {
      status: `${statusIcon} ${statusCode}`,
      name: span.name,
      kind: span.span_kind || "UNKNOWN",
      duration: formatDurationMs(span.start_time, span.end_time),
      span_id: span.context?.span_id || "n/a",
      trace_id: span.context?.trace_id || "n/a",
      time: formatTimestamp(span.start_time),
    };

    if (hasAnnotations) {
      row.annotations = formatAnnotations(span.annotations);
    }
    if (hasNotes) {
      row.notes = formatNotes(span.notes);
    }

    return row;
  });

  const header = `Showing ${spans.length} span(s)`;
  const table = formatTable(rows);
  return `${header}\n${table}`;
}

function formatDurationMs(startTime: string, endTime: string): string {
  const startMs = Date.parse(startTime);
  const endMs = Date.parse(endTime);
  if (Number.isNaN(startMs) || Number.isNaN(endMs)) {
    return "n/a";
  }
  return `${Math.max(0, endMs - startMs)}ms`;
}

function formatTimestamp(isoString: string): string {
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return isoString;
  return d
    .toISOString()
    .replace("T", " ")
    .replace(/\.\d{3}Z$/, " UTC");
}

function formatAnnotations(annotations: SpanAnnotation[] | undefined): string {
  if (!annotations || annotations.length === 0) return "";
  return annotations
    .map((a) => {
      const pieces: string[] = [a.name];
      if (a.result?.score != null) pieces.push(`=${a.result.score}`);
      if (a.result?.label) pieces.push(`(${a.result.label})`);
      return pieces.join("");
    })
    .join(", ");
}

function formatNotes(notes: SpanAnnotation[] | undefined): string {
  if (!notes || notes.length === 0) return "";
  return notes
    .map((note) => note.result?.explanation?.replace(/\s+/g, " ").trim() || "")
    .filter((noteText) => noteText.length > 0)
    .join(" | ");
}
