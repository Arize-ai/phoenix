import { createClient } from "../client";
import { DELETE_SESSION } from "../constants/serverRequirements";
import type { ClientFn } from "../types/core";
import { ensureServerCapability } from "../utils/serverVersionUtils";

/**
 * Parameters to delete a session
 */
export interface DeleteSessionParams extends ClientFn {
  /**
   * The session ID. Can be either:
   * - A user-provided session ID string
   * - A Phoenix Global ID (base64-encoded)
   */
  sessionId: string;
}

/**
 * Delete a single session by ID.
 *
 * This will permanently remove the session and all associated traces, spans,
 * and annotations via cascade delete.
 *
 * @experimental this function is experimental and may change in the future
 *
 * @param params - The parameters to delete a session
 * @returns Promise that resolves when the session is successfully deleted
 * @throws Error if the session is not found or deletion fails
 *
 * @requires Phoenix server >= 13.13.0
 *
 * @example
 * ```ts
 * // Delete by user-provided session ID
 * await deleteSession({
 *   client,
 *   sessionId: "my-session-id"
 * });
 *
 * // Delete by Phoenix Global ID
 * await deleteSession({
 *   client,
 *   sessionId: "UHJvamVjdFNlc3Npb246MTIz"
 * });
 * ```
 */
export async function deleteSession({
  client: _client,
  sessionId,
}: DeleteSessionParams): Promise<void> {
  const client = _client ?? createClient();
  await ensureServerCapability({ client, requirement: DELETE_SESSION });

  const { error } = await client.DELETE("/v1/sessions/{session_identifier}", {
    params: {
      path: {
        session_identifier: sessionId,
      },
    },
  });

  if (error) {
    const isNotFound =
      typeof error === "object" &&
      error !== null &&
      "status" in error &&
      error.status === 404;
    if (isNotFound) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const errorMessage =
      typeof error === "object" && error !== null
        ? JSON.stringify(error, null, 2)
        : String(error);
    throw new Error(`Failed to delete session: ${errorMessage}`);
  }
}
