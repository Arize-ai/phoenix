import invariant from "tiny-invariant";

import type { components } from "../__generated__/api/v1";
import { createClient } from "../client";
import { LIST_PROJECT_SESSIONS } from "../constants/serverRequirements";
import type { ClientFn } from "../types/core";
import type { ProjectIdentifier } from "../types/projects";
import { resolveProjectIdentifier } from "../types/projects";
import type { Session } from "../types/sessions";
import { ensureServerCapability } from "../utils/serverVersionUtils";
import { toSession } from "./sessionUtils";

export type ListSessionsParams = ClientFn & ProjectIdentifier;

type SessionsResponse = components["schemas"]["GetSessionsResponseBody"];

const DEFAULT_PAGE_SIZE = 100;

/**
 * List all sessions for a project with automatic pagination handling.
 *
 * @requires Phoenix server >= 13.5.0
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
  await ensureServerCapability({ client, requirement: LIST_PROJECT_SESSIONS });
  const projectIdentifier = resolveProjectIdentifier(params);

  const sessions: Session[] = [];
  let cursor: string | null | undefined = null;

  do {
    const response: { data?: SessionsResponse; error?: unknown } =
      await client.GET("/v1/projects/{project_identifier}/sessions", {
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

    if (response.error) throw response.error;
    invariant(response.data?.data, "Failed to list sessions");

    cursor = response.data.next_cursor ?? null;
    sessions.push(...response.data.data.map(toSession));
  } while (cursor != null);

  return sessions;
}
