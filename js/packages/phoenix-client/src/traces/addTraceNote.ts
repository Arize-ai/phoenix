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
 * Notes are a special type of annotation that allow multiple entries per trace.
 * Each note gets a unique timestamp-based identifier.
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
