import type { componentsV1 } from "@arizeai/phoenix-client";

export type OutputFormat = "pretty" | "json" | "raw";

type SessionData = componentsV1["schemas"]["SessionData"];
type SessionAnnotation = componentsV1["schemas"]["SessionAnnotation"];

export interface FormatSessionsOutputOptions {
  sessions: SessionData[];
  format?: OutputFormat;
}

export function formatSessionsOutput({
  sessions,
  format,
}: FormatSessionsOutputOptions): string {
  const selected = format || "pretty";
  if (selected === "raw") {
    return JSON.stringify(sessions);
  }
  if (selected === "json") {
    return JSON.stringify(sessions, null, 2);
  }
  return formatSessionsPretty(sessions);
}

export interface FormatSessionOutputOptions {
  session: SessionData;
  annotations?: SessionAnnotation[];
  format?: OutputFormat;
}

export function formatSessionOutput({
  session,
  annotations,
  format,
}: FormatSessionOutputOptions): string {
  const selected = format || "pretty";
  if (selected === "raw") {
    return JSON.stringify({ session, annotations });
  }
  if (selected === "json") {
    return JSON.stringify({ session, annotations }, null, 2);
  }
  return formatSessionPretty(session, annotations);
}

function formatSessionsPretty(sessions: SessionData[]): string {
  if (sessions.length === 0) {
    return "No sessions found";
  }

  const lines: string[] = [];
  lines.push("Sessions:");
  lines.push("");

  for (const session of sessions) {
    lines.push(`┌─ ${session.session_id}`);
    lines.push(`│  ID: ${session.id}`);
    lines.push(`│  Traces: ${session.traces.length}`);
    lines.push(`│  Started: ${formatDate(session.start_time)}`);
    lines.push(`│  Ended: ${formatDate(session.end_time)}`);
    lines.push(
      `│  Duration: ${formatDuration(session.start_time, session.end_time)}`
    );
    lines.push(`└─`);
    lines.push("");
  }

  return lines.join("\n").trimEnd();
}

function formatSessionPretty(
  session: SessionData,
  annotations?: SessionAnnotation[]
): string {
  const lines: string[] = [];

  lines.push(`┌─ Session: ${session.session_id}`);
  lines.push(`│  ID: ${session.id}`);
  lines.push(`│  Project: ${session.project_id}`);
  lines.push(`│  Started: ${formatDate(session.start_time)}`);
  lines.push(`│  Ended: ${formatDate(session.end_time)}`);
  lines.push(`│  Turns: ${session.traces.length}`);
  lines.push(`│`);

  if (session.traces.length > 0) {
    // Sort traces by start_time ascending (chronological order)
    const sortedTraces = [...session.traces].sort(
      (a, b) =>
        new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
    );

    lines.push(`│  Traces:`);

    for (let i = 0; i < sortedTraces.length; i++) {
      const trace = sortedTraces[i]!;
      const isLast = i === sortedTraces.length - 1;
      const connector = isLast ? "└─" : "├─";
      const continuation = isLast ? "  " : "│ ";

      const startTime = formatTime(trace.start_time);
      const endTime = formatTime(trace.end_time);
      const duration = formatDuration(trace.start_time, trace.end_time);

      lines.push(
        `│  ${connector} [Turn ${i + 1}] ${startTime} - ${endTime} (${duration})`
      );
      lines.push(`│  ${continuation} trace: ${trace.trace_id}`);
    }
  }

  if (annotations && annotations.length > 0) {
    lines.push(`│`);
    lines.push(`│  Annotations:`);
    for (const annotation of annotations) {
      const parts: string[] = [];
      if (annotation.result?.score != null) {
        parts.push(`score=${annotation.result.score}`);
      }
      if (annotation.result?.label) {
        parts.push(`label="${annotation.result.label}"`);
      }
      const detail = parts.length > 0 ? `: ${parts.join(", ")}` : "";
      lines.push(
        `│    - ${annotation.name} (${annotation.annotator_kind})${detail}`
      );
    }
  }

  lines.push(`└─`);

  return lines.join("\n");
}

function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleString();
  } catch {
    return dateStr;
  }
}

function formatTime(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleTimeString();
  } catch {
    return dateStr;
  }
}

function formatDuration(startStr: string, endStr: string): string {
  const startMs = Date.parse(startStr);
  const endMs = Date.parse(endStr);
  if (Number.isNaN(startMs) || Number.isNaN(endMs)) {
    return "n/a";
  }
  const diffMs = Math.max(0, endMs - startMs);
  const totalSeconds = Math.floor(diffMs / 1000);

  if (totalSeconds < 60) {
    return `${totalSeconds}s`;
  }

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes < 60) {
    return `${minutes}m ${seconds}s`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m ${seconds}s`;
}
