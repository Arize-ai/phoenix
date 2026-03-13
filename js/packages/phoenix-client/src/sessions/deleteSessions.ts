import { createClient } from "../client";
import { DELETE_SESSIONS } from "../constants/serverRequirements";
import type { ClientFn } from "../types/core";
import { ensureServerCapability } from "../utils/serverVersionUtils";

/**
 * Parameters to bulk delete sessions
 */
export interface DeleteSessionsParams extends ClientFn {
  /**
   * List of session identifiers to delete. Each can be either:
   * - A user-provided session ID string
   * - A Phoenix Global ID (base64-encoded)
   *
   * All identifiers must be the same type (no mixing).
   */
  sessionIds: string[];
}

/**
 * Delete multiple sessions by their identifiers.
 *
 * All identifiers must be the same type: either all GlobalIDs or all
 * user-provided session_id strings. Non-existent IDs are silently skipped.
 * All associated traces, spans, and annotations are cascade deleted.
 *
 * @experimental this function is experimental and may change in the future
 *
 * @param params - The parameters to bulk delete sessions
 * @returns Promise that resolves when the sessions are successfully deleted
 * @throws Error if identifiers are mixed types or deletion fails
 *
 * @requires Phoenix server >= 13.13.0
 *
 * @example
 * ```ts
 * // Delete by user-provided session IDs
 * await deleteSessions({
 *   client,
 *   sessionIds: ["session-1", "session-2", "session-3"]
 * });
 *
 * // Delete by Phoenix Global IDs
 * await deleteSessions({
 *   client,
 *   sessionIds: ["UHJvamVjdFNlc3Npb246MQ==", "UHJvamVjdFNlc3Npb246Mg=="]
 * });
 * ```
 */
export async function deleteSessions({
  client: _client,
  sessionIds,
}: DeleteSessionsParams): Promise<void> {
  const client = _client ?? createClient();
  await ensureServerCapability({ client, requirement: DELETE_SESSIONS });

  const { error } = await client.POST("/v1/sessions/delete", {
    body: {
      session_identifiers: sessionIds,
    },
  });

  if (error) {
    const errorMessage =
      typeof error === "object" && error !== null
        ? JSON.stringify(error, null, 2)
        : String(error);
    throw new Error(`Failed to delete sessions: ${errorMessage}`);
  }
}
