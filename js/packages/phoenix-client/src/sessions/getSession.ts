import invariant from "tiny-invariant";

import { createClient } from "../client";
import type { ClientFn } from "../types/core";
import type { Session } from "../types/sessions";

export type GetSessionParams = ClientFn & {
  /**
   * The session identifier: either a GlobalID or user-provided session_id string.
   */
  sessionId: string;
};

/**
 * Fetch a single session by its GlobalID or user-provided session_id string.
 *
 * @example
 * ```ts
 * import { getSession } from "@arizeai/phoenix-client/sessions";
 *
 * const session = await getSession({ sessionId: "my-session-id" });
 * console.log(session.traces.length);
 * ```
 */
export async function getSession({
  client: _client,
  sessionId,
}: GetSessionParams): Promise<Session> {
  const client = _client || createClient();
  const { data: { data: sessionData } = { data: undefined } } =
    await client.GET("/v1/sessions/{session_identifier}", {
      params: {
        path: {
          session_identifier: sessionId,
        },
      },
    });
  invariant(sessionData, "Failed to get session");
  return {
    id: sessionData.id,
    sessionId: sessionData.session_id,
    projectId: sessionData.project_id,
    startTime: sessionData.start_time,
    endTime: sessionData.end_time,
    traces: sessionData.traces.map((trace) => ({
      id: trace.id,
      traceId: trace.trace_id,
      startTime: trace.start_time,
      endTime: trace.end_time,
    })),
  };
}
