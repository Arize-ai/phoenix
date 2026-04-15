import { createClient } from "../client";
import type { ClientFn } from "../types/core";

export interface TraceNote {
  traceId: string;
  note: string;
}

export interface AddTraceNoteParams extends ClientFn {
  traceNote: TraceNote;
}

export async function addTraceNote({
  client: _client,
  traceNote,
}: AddTraceNoteParams): Promise<{ id: string }> {
  const client = _client ?? createClient();

  const { data, error } = await client.POST("/v1/trace_notes", {
    body: {
      data: {
        trace_id: traceNote.traceId.trim(),
        note: traceNote.note,
      },
    },
  });

  if (error) {
    throw new Error(`Failed to add trace note: ${error}`);
  }

  if (!data?.data) {
    throw new Error("Failed to add trace note: no data returned");
  }

  return data.data;
}
