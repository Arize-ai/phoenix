import invariant from "tiny-invariant";

import type { components } from "../__generated__/api/v1";
import { createClient } from "../client";
import type { ClientFn } from "../types/core";
import type { ProjectIdentifier } from "../types/projects";
import { resolveProjectIdentifier } from "../types/projects";
import type { Session } from "../types/sessions";
import { toSession } from "./sessionUtils";

export type ListSessionsParams = ClientFn & ProjectIdentifier;

const DEFAULT_PAGE_SIZE = 100;

/**
 * List all sessions for a project with automatic pagination handling.
 *
 * @example
 * ```ts
 * import { listSessions } from "@arizeai/phoenix-client/sessions";
 *
 * const sessions = await listSessions({
 *   project: "my-project",
 * });
 *
 * for (const session of sessions) {
 *   console.log(`Session: ${session.sessionId}, Traces: ${session.traces.length}`);
 * }
 * ```
 */
export async function listSessions(
  params: ListSessionsParams
): Promise<Session[]> {
  const client = params.client || createClient();
  const projectIdentifier = resolveProjectIdentifier(params);

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

    cursor = res.data?.next_cursor ?? null;
    const data = res.data?.data;
    invariant(data, "Failed to list sessions");

    sessions.push(...data.map(toSession));
  } while (cursor != null);

  return sessions;
}
