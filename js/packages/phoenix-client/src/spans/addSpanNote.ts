import { createClient } from "../client";
import type { ClientFn } from "../types/core";

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
 * Notes are append-only: each call creates a new note with an auto-generated
 * UUIDv4 identifier, so multiple notes accumulate on the same span. Structured
 * annotations, by contrast, are keyed by `(name, spanId, identifier)` — to keep
 * multiple structured annotations with the same name on a span, supply distinct
 * identifiers; otherwise re-writing the same name overwrites the existing one.
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
      },
    },
  });

  if (error) {
    throw new Error(`Failed to add span note: ${error}`);
  }

  if (!data?.data) {
    throw new Error("Failed to add span note: no data returned");
  }

  return data.data;
}
