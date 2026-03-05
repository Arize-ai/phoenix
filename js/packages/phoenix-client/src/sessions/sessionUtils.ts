import type { components } from "../__generated__/api/v1";
import type { Session } from "../types/sessions";

type SessionData = components["schemas"]["SessionData"];

/**
 * Convert an API SessionData response to a user-facing Session object.
 */
export function toSession(data: SessionData): Session {
  return {
    id: data.id,
    sessionId: data.session_id,
    projectId: data.project_id,
    startTime: data.start_time,
    endTime: data.end_time,
    traces: data.traces.map((trace) => ({
      id: trace.id,
      traceId: trace.trace_id,
      startTime: trace.start_time,
      endTime: trace.end_time,
    })),
  };
}
