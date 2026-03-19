import type { SpanAnnotation, SpanWithAnnotations } from "../trace";

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

const SEPARATOR = "─".repeat(80);

function formatSpansPretty(spans: SpanWithAnnotations[]): string {
  const lines: string[] = [];

  lines.push(`Showing ${spans.length} span(s)`);
  lines.push("");

  for (const span of spans) {
    lines.push(SEPARATOR);

    const status = span.status_code === "ERROR" ? "✗" : "✓";
    const duration = formatDurationMs(span.start_time, span.end_time);
    const kind = span.span_kind || "UNKNOWN";

    lines.push(
      `  ${status} ${span.name}  (${kind})  ${duration}`
    );

    const spanId = span.context?.span_id || "n/a";
    const traceId = span.context?.trace_id || "n/a";
    lines.push(
      `  Span: ${spanId}   Trace: ${truncateId(traceId, 24)}`
    );

    lines.push(`  Status: ${span.status_code || "UNSET"}   Time: ${formatTimestamp(span.start_time)}`);

    if (span.status_code === "ERROR" && span.status_message) {
      lines.push(`  Error: ${span.status_message}`);
    }

    if (span.parent_id) {
      lines.push(`  Parent: ${span.parent_id}`);
    }

    const annotations = span.annotations;
    if (annotations && annotations.length > 0) {
      const parts = annotations.map((a: SpanAnnotation) => {
        const pieces: string[] = [a.name];
        if (a.result?.score != null) pieces.push(`=${a.result.score}`);
        if (a.result?.label) pieces.push(`(${a.result.label})`);
        return pieces.join("");
      });
      lines.push(`  Annotations: ${parts.join(", ")}`);
    }
  }

  lines.push(SEPARATOR);
  return lines.join("\n");
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
  return d.toISOString().replace("T", " ").replace(/\.\d{3}Z$/, " UTC");
}

function truncateId(id: string, maxLen: number): string {
  if (id.length <= maxLen) return id;
  return id.slice(0, maxLen - 3) + "...";
}
