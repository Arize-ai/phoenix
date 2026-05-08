import { createClient } from "../client";
import type { ClientFn } from "../types/core";
import { formatApiError } from "../utils/apiErrorUtils";

/**
 * Parameters for a single span note
 */
export interface SpanNote {
  /**
   * The OpenTelemetry Span ID (hex format without 0x prefix)
   */
  spanId: string;
  /**
   * The note text to add to the span
   */
  note: string;
  /**
   * Optional caller-supplied identifier. When non-empty, the note is upserted
   * on `(spanId, name='note', identifier)` — repeated calls with the same
   * identifier overwrite the existing note. When omitted, the server stamps a
   * unique `px-span-note:<uuid>` identifier so each call appends a new note.
   */
  identifier?: string;
}

/**
 * Parameters to add a span note
 */
export interface AddSpanNoteParams extends ClientFn {
  spanNote: SpanNote;
}

/**
 * Add a note to a span.
 *
 * When `spanNote.identifier` is omitted, each call appends a new note with an
 * auto-generated identifier. When `identifier` is non-empty, repeated calls
 * with the same `(spanId, name='note', identifier)` overwrite the existing
 * note.
 *
 * @param params - The parameters to add a span note
 * @returns The ID of the created note annotation
 *
 * @example
 * ```ts
 * const result = await addSpanNote({
 *   spanNote: {
 *     spanId: "123abc",
 *     note: "This span looks suspicious, needs review"
 *   }
 * });
 * ```
 */
export async function addSpanNote({
  client: _client,
  spanNote,
}: AddSpanNoteParams): Promise<{ id: string }> {
  const client = _client ?? createClient();

  const { data, error } = await client.POST("/v1/span_notes", {
    body: {
      data: {
        span_id: spanNote.spanId.trim(),
        note: spanNote.note,
        identifier: spanNote.identifier,
      },
    },
  });

  if (error) {
    throw new Error(`Failed to add span note: ${formatApiError(error)}`);
  }

  if (!data?.data) {
    throw new Error("Failed to add span note: no data returned");
  }

  return data.data;
}
