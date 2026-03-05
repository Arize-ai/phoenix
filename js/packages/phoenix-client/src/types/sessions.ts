import type { Node } from "./core";

/**
 * Identifies a project. Accepts any of:
 * - `project` — a project ID or name (the server accepts either)
 * - `projectId` — an explicit project ID
 * - `projectName` — an explicit project name
 */
export type ProjectIdentifier =
  | { project: string }
  | { projectId: string }
  | { projectName: string };

/**
 * A trace that belongs to a session.
 */
export interface SessionTrace extends Node {
  /** The unique trace identifier (e.g. OpenTelemetry trace ID) */
  traceId: string;
  /** ISO 8601 timestamp of when the trace started */
  startTime: string;
  /** ISO 8601 timestamp of when the trace ended */
  endTime: string;
}

/**
 * A session representing a group of related traces (e.g. a multi-turn conversation).
 */
export interface Session extends Node {
  /** The user-provided session identifier */
  sessionId: string;
  /** The ID of the project this session belongs to */
  projectId: string;
  /** ISO 8601 timestamp of when the first trace in the session started */
  startTime: string;
  /** ISO 8601 timestamp of when the last trace in the session ended */
  endTime: string;
  /** The traces that belong to this session */
  traces: SessionTrace[];
}
