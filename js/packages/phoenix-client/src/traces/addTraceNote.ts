import { createClient } from "../client";
import { ADD_TRACE_NOTE } from "../constants/serverRequirements";
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
 * Notes are append-only: each call creates a new note with an auto-generated
 * UUIDv4 identifier, so multiple notes accumulate on the same trace. Structured
 * annotations, by contrast, are keyed by `(name, traceId, identifier)` — to keep
 * multiple structured annotations with the same name on a trace, supply distinct
 * identifiers; otherwise re-writing the same name overwrites the existing one.
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

  const { data, error } = await client.POST("/v1/trace_notes", {
    body: {
      data: {
        trace_id: traceNote.traceId.trim(),
        note: traceNote.note,
        ...(traceNote.identifier !== undefined && {
          identifier: traceNote.identifier,
        }),
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
