import type { componentsV1 } from "@arizeai/phoenix-client";

import { formatTable } from "./formatTable";

export type OutputFormat = "pretty" | "json" | "raw";

type SessionData = componentsV1["schemas"]["SessionData"];
type SessionAnnotation = componentsV1["schemas"]["SessionAnnotation"];

type NoteResult = {
  explanation?: string | null;
};

export type SessionNote = Omit<SessionAnnotation, "name" | "result"> & {
  name: "note";
  result?: NoteResult | null;
};

export type SessionWithAnnotations = SessionData & {
  annotations?: SessionAnnotation[];
  notes?: SessionNote[];
};

export interface FormatSessionsOutputOptions {
  sessions: SessionWithAnnotations[];
  format?: OutputFormat;
  includeAnnotations?: boolean;
  includeNotes?: boolean;
}

export function formatSessionsOutput({
  sessions,
  format,
  includeAnnotations,
  includeNotes,
}: FormatSessionsOutputOptions): string {
  const selected = format || "pretty";
  if (selected === "raw") {
    return JSON.stringify(sessions);
  }
  if (selected === "json") {
    return JSON.stringify(sessions, null, 2);
  }
  return formatSessionsPretty({ sessions, includeAnnotations, includeNotes });
}

export interface FormatSessionOutputOptions {
  session: SessionWithAnnotations;
  format?: OutputFormat;
}

export function formatSessionOutput({
  session,
  format,
}: FormatSessionOutputOptions): string {
  const selected = format || "pretty";
  if (selected === "raw") {
    return JSON.stringify({ session });
  }
  if (selected === "json") {
    return JSON.stringify({ session }, null, 2);
  }
  return formatSessionPretty(session);
}

function formatSessionsPretty({
  sessions,
  includeAnnotations,
  includeNotes,
}: {
  sessions: SessionWithAnnotations[];
  includeAnnotations?: boolean;
  includeNotes?: boolean;
}): string {
  if (sessions.length === 0) {
    return "No sessions found";
  }

  const shouldShowAnnotationsColumn =
    Boolean(includeAnnotations) ||
    sessions.some(
      (session) => session.annotations && session.annotations.length > 0
    );
  const shouldShowNotesColumn =
    Boolean(includeNotes) ||
    sessions.some((session) => session.notes && session.notes.length > 0);

  const rows = sessions.map((s) => ({
    session_id: s.session_id,
    id: s.id,
    traces: s.traces.length,
    duration: formatDuration(s.start_time, s.end_time),
    started: formatDate(s.start_time),
    ended: formatDate(s.end_time),
    ...(shouldShowAnnotationsColumn
      ? { annotations: formatAnnotations(s.annotations) }
      : {}),
    ...(shouldShowNotesColumn ? { notes: formatNotes(s.notes) } : {}),
  }));

  return formatTable(rows);
}

function formatSessionPretty(session: SessionWithAnnotations): string {
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

  if (session.annotations && session.annotations.length > 0) {
    lines.push(`│`);
    lines.push(`│  Annotations:`);
    for (const annotation of session.annotations) {
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

  if (session.notes && session.notes.length > 0) {
    lines.push(`│`);
    lines.push(`│  Notes:`);
    for (const note of session.notes) {
      const noteText = note.result?.explanation?.trim();
      if (noteText) {
        lines.push(`│    - ${noteText}`);
      }
    }
  }

  lines.push(`└─`);

  return lines.join("\n");
}

function formatAnnotations(
  annotations: SessionAnnotation[] | undefined
): string {
  if (!annotations || annotations.length === 0) return "";
  return annotations
    .map((annotation) => {
      const pieces: string[] = [annotation.name];
      if (annotation.result?.score != null) {
        pieces.push(`=${annotation.result.score}`);
      }
      if (annotation.result?.label) {
        pieces.push(`(${annotation.result.label})`);
      }
      return pieces.join("");
    })
    .join(", ");
}

function formatNotes(notes: SessionNote[] | undefined): string {
  if (!notes || notes.length === 0) return "";
  return notes
    .map((note) => note.result?.explanation?.replace(/\s+/g, " ").trim() || "")
    .filter((noteText) => noteText.length > 0)
    .join(" | ");
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
