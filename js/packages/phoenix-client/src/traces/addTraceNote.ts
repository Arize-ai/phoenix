import { createClient } from "../client";
import {
  ADD_TRACE_NOTE,
  ADD_TRACE_NOTE_IDENTIFIER,
} from "../constants/serverRequirements";
import type { ClientFn } from "../types/core";
import { formatApiError } from "../utils/apiErrorUtils";
import { ensureServerCapability } from "../utils/serverVersionUtils";

/**
 * Parameters for a single trace note.
 */
export interface TraceNote {
  /**
   * The OpenTelemetry trace ID (hex format without 0x prefix).
   */
  traceId: string;
  /**
   * The note text to add to the trace.
   */
  note: string;
  /**
   * Optional caller-supplied identifier. When non-empty, the note is upserted
   * on `(traceId, name='note', identifier)` — repeated calls with the same
   * identifier overwrite the existing note. When omitted, the server stamps a
   * unique `px-trace-note:<uuid>` identifier so each call appends a new note.
   */
  identifier?: string;
}

/**
 * Parameters to add a trace note.
 */
export interface AddTraceNoteParams extends ClientFn {
  traceNote: TraceNote;
}

/**
 * Add a note to a trace.
 *
 * When `traceNote.identifier` is omitted, each call appends a new note with an
 * auto-generated identifier. When `identifier` is non-empty, repeated calls
 * with the same `(traceId, name='note', identifier)` overwrite the existing
 * note.
 *
 * @param params - The parameters to add a trace note.
 * @returns The ID of the created note annotation.
 *
 * @example
 * ```ts
 * const result = await addTraceNote({
 *   traceNote: {
 *     traceId: "abc123",
 *     note: "Needs review"
 *   }
 * });
 * ```
 */
export async function addTraceNote({
  client: _client,
  traceNote,
}: AddTraceNoteParams): Promise<{ id: string }> {
  const client = _client ?? createClient();
  await ensureServerCapability({ client, requirement: ADD_TRACE_NOTE });
  if (traceNote.identifier) {
    await ensureServerCapability({
      client,
      requirement: ADD_TRACE_NOTE_IDENTIFIER,
    });
  }

  const { data, error } = await client.POST("/v1/trace_notes", {
    body: {
      data: {
        trace_id: traceNote.traceId.trim(),
        note: traceNote.note,
        identifier: traceNote.identifier,
      },
    },
  });

  if (error) {
    throw new Error(`Failed to add trace note: ${formatApiError(error)}`);
  }

  if (!data?.data) {
    throw new Error("Failed to add trace note: no data returned");
  }

  return data.data;
}
