import invariant from "tiny-invariant";

import { createClient } from "../client";
import { GET_SESSION } from "../constants/serverRequirements";
import type { ClientFn } from "../types/core";
import type { Session } from "../types/sessions";
import { ensureServerCapability } from "../utils/serverVersionUtils";
import { toSession } from "./sessionUtils";

export type GetSessionParams = ClientFn & {
  /**
   * The session identifier: either a GlobalID or user-provided session_id string.
   */
  sessionId: string;
};

/**
 * Fetch a single session by its GlobalID or user-provided session_id string.
 *
 * @requires Phoenix server >= 13.5.0
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
  await ensureServerCapability({ client, requirement: GET_SESSION });
  const { data, error } = await client.GET(
    "/v1/sessions/{session_identifier}",
    {
      params: {
        path: {
          session_identifier: sessionId,
        },
      },
    }
  );
  if (error) throw error;
  invariant(data?.data, "Failed to get session");
  return toSession(data.data);
}
