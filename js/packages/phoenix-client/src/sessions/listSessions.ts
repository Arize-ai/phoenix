import invariant from "tiny-invariant";

import type { components } from "../__generated__/api/v1";
import { createClient } from "../client";
import type { ClientFn } from "../types/core";
import type { Session } from "../types/sessions";

export type ListSessionsParams = ClientFn & {
  /**
   * The project identifier: either project ID or project name.
   */
  projectIdentifier: string;
};

const DEFAULT_PAGE_SIZE = 100;

/**
 * List all sessions for a project with automatic pagination handling.
 *
 * @example
 * ```ts
 * import { listSessions } from "@arizeai/phoenix-client/sessions";
 *
 * const sessions = await listSessions({
 *   projectIdentifier: "my-project",
 * });
 *
 * for (const session of sessions) {
 *   console.log(`Session: ${session.sessionId}, Traces: ${session.traces.length}`);
 * }
 * ```
 */
export async function listSessions({
  client: _client,
  projectIdentifier,
}: ListSessionsParams): Promise<Session[]> {
  const client = _client || createClient();

  const sessions: Session[] = [];
  let cursor: string | null = null;

  do {
    const res: {
      data?: components["schemas"]["GetSessionsResponseBody"];
    } = await client.GET("/v1/projects/{project_identifier}/sessions", {
      params: {
        path: {
          project_identifier: projectIdentifier,
        },
        query: {
          cursor,
          limit: DEFAULT_PAGE_SIZE,
        },
      },
    });

    cursor = res.data?.next_cursor || null;
    const data = res.data?.data;
    invariant(data, "Failed to list sessions");

    sessions.push(
      ...data.map((s) => ({
        id: s.id,
        sessionId: s.session_id,
        projectId: s.project_id,
        startTime: s.start_time,
        endTime: s.end_time,
        traces: s.traces.map((trace) => ({
          id: trace.id,
          traceId: trace.trace_id,
          startTime: trace.start_time,
          endTime: trace.end_time,
        })),
      }))
    );
  } while (cursor != null);

  return sessions;
}
