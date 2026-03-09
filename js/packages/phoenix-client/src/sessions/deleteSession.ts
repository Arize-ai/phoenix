import { createClient } from "../client";
import type { ClientFn } from "../types/core";

/**
 * Parameters to delete a session
 */
export interface DeleteSessionParams extends ClientFn {
  /**
   * The session identifier. Can be either:
   * - A user-provided session_id string
   * - A Phoenix Global ID (base64-encoded)
   */
  sessionIdentifier: string;
}

/**
 * Delete a single session by identifier.
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
 * @example
 * ```ts
 * // Delete by user-provided session_id
 * await deleteSession({
 *   client,
 *   sessionIdentifier: "my-session-id"
 * });
 *
 * // Delete by Phoenix Global ID
 * await deleteSession({
 *   client,
 *   sessionIdentifier: "UHJvamVjdFNlc3Npb246MTIz"
 * });
 * ```
 */
export async function deleteSession({
  client: _client,
  sessionIdentifier,
}: DeleteSessionParams): Promise<void> {
  const client = _client ?? createClient();

  const { error } = await client.DELETE("/v1/sessions/{session_identifier}", {
    params: {
      path: {
        session_identifier: sessionIdentifier,
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
      throw new Error(`Session not found: ${sessionIdentifier}`);
    }

    const errorMessage =
      typeof error === "object" && error !== null
        ? JSON.stringify(error, null, 2)
        : String(error);
    throw new Error(`Failed to delete session: ${errorMessage}`);
  }
}
