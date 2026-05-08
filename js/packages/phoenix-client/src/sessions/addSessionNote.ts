import { createClient } from "../client";
import { ADD_SESSION_NOTE } from "../constants/serverRequirements";
import type { ClientFn } from "../types/core";
import { formatApiError } from "../utils/apiErrorUtils";
import { ensureServerCapability } from "../utils/serverVersionUtils";

/**
 * Parameters for a single session note.
 */
export interface SessionNote {
  /**
   * The session ID used to track a conversation, thread, or session.
   */
  sessionId: string;
  /**
   * The note text to add to the session.
   */
  note: string;
  /**
   * Optional caller-supplied identifier. When non-empty, the note is upserted
   * on `(sessionId, name='note', identifier)` — repeated calls with the same
   * identifier overwrite the existing note. When omitted, the server stamps a
   * unique `px-session-note:<uuid>` identifier so each call appends a new note.
   */
  identifier?: string;
}

/**
 * Parameters to add a session note.
 */
export interface AddSessionNoteParams extends ClientFn {
  sessionNote: SessionNote;
}

/**
 * Add a note to a session.
 *
 * Notes are a special type of annotation that allow multiple entries per session.
 * Each note gets a unique UUIDv4 identifier.
 *
 * @param params - The parameters to add a session note.
 * @returns The ID of the created note annotation.
 *
 * @requires Phoenix server >= 14.17.0
 *
 * @example
 * ```ts
 * const result = await addSessionNote({
 *   sessionNote: {
 *     sessionId: "my-session",
 *     note: "Needs review"
 *   }
 * });
 * ```
 */
export async function addSessionNote({
  client: _client,
  sessionNote,
}: AddSessionNoteParams): Promise<{ id: string }> {
  const client = _client ?? createClient();
  await ensureServerCapability({ client, requirement: ADD_SESSION_NOTE });

  const { data, error } = await client.POST("/v1/session_notes", {
    body: {
      data: {
        session_id: sessionNote.sessionId.trim(),
        note: sessionNote.note,
        identifier: sessionNote.identifier,
      },
    },
  });

  if (error) {
    throw new Error(`Failed to add session note: ${formatApiError(error)}`);
  }

  if (!data?.data) {
    throw new Error("Failed to add session note: no data returned");
  }

  return data.data;
}
