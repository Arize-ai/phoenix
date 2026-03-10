import { SemanticConventions } from "@arizeai/openinference-semantic-conventions";

import type { components } from "../__generated__/api/v1";
import { createClient } from "../client";
import { getSpans } from "../spans/getSpans";
import type { ClientFn } from "../types/core";
import type { Session, SessionTrace } from "../types/sessions";
import { getSession } from "./getSession";

type Span = components["schemas"]["Span"];

const MAX_TRACE_IDS_PER_BATCH = 50;

/**
 * Input or output extracted from a root span's attributes.
 *
 * @experimental this interface is experimental and may change in the future
 */
export interface ConversationTurnIO {
  /** The string value of the input or output */
  value: string;
  /** Optional MIME type (e.g. "text/plain", "application/json") */
  mimeType?: string;
}

/**
 * A single turn in a session conversation, representing one trace's input/output.
 *
 * @experimental this interface is experimental and may change in the future
 */
export interface ConversationTurn {
  /** The trace ID for this turn */
  traceId: string;
  /** ISO 8601 timestamp of when the trace started */
  startTime: string;
  /** ISO 8601 timestamp of when the trace ended */
  endTime: string;
  /** Input extracted from the root span's attributes */
  input?: ConversationTurnIO;
  /** Output extracted from the root span's attributes */
  output?: ConversationTurnIO;
  /** The full root span, if found */
  rootSpan?: Span;
}

/**
 * @experimental this interface is experimental and may change in the future
 */
export interface GetSessionConversationParams extends ClientFn {
  /** The session identifier: either a GlobalID or user-provided session_id string. */
  sessionId: string;
}

/**
 * Get a conversation view of a session.
 *
 * Returns input/output extracted from root spans for each trace, along with
 * the full root span. Turns are ordered by trace start_time.
 *
 * @experimental this function is experimental and may change in the future
 *
 * @example
 * ```ts
 * import { getSessionConversation } from "@arizeai/phoenix-client/sessions";
 *
 * const turns = await getSessionConversation({ sessionId: "my-session" });
 * for (const turn of turns) {
 *   console.log(`[${turn.startTime}] Input: ${turn.input?.value}`);
 *   console.log(`[${turn.startTime}] Output: ${turn.output?.value}`);
 * }
 * ```
 */
export async function getSessionConversation({
  client: _client,
  sessionId,
}: GetSessionConversationParams): Promise<ConversationTurn[]> {
  const client = _client ?? createClient();

  const session: Session = await getSession({ client, sessionId });
  const traces = session.traces;
  if (traces.length === 0) {
    return [];
  }

  const projectId = session.projectId;
  const traceInfo = new Map<string, SessionTrace>(
    traces.map((t) => [t.traceId, t])
  );
  const allTraceIds = [...traceInfo.keys()];

  // Fetch root spans in batches
  const rootSpansByTrace = new Map<string, Span>();
  for (let i = 0; i < allTraceIds.length; i += MAX_TRACE_IDS_PER_BATCH) {
    const traceIdBatch = allTraceIds.slice(i, i + MAX_TRACE_IDS_PER_BATCH);
    const spans = await getAllRootSpansForBatch({
      client,
      projectId,
      traceIdBatch,
    });
    for (const span of spans) {
      const traceId = span.context.trace_id;
      if (!rootSpansByTrace.has(traceId)) {
        rootSpansByTrace.set(traceId, span);
      }
    }
  }

  return buildConversationTurns({ allTraceIds, traceInfo, rootSpansByTrace });
}

/**
 * Fetch all root spans for a batch of trace IDs, handling pagination.
 */
async function getAllRootSpansForBatch({
  client,
  projectId,
  traceIdBatch,
}: {
  client: ReturnType<typeof createClient>;
  projectId: string;
  traceIdBatch: string[];
}): Promise<Span[]> {
  const allSpans: Span[] = [];
  let cursor: string | null = null;

  do {
    const result = await getSpans({
      client,
      project: { projectId },
      traceIds: traceIdBatch,
      parentId: null,
      limit: traceIdBatch.length,
      ...(cursor ? { cursor } : {}),
    });
    allSpans.push(...result.spans);
    cursor = result.nextCursor;
  } while (cursor != null);

  return allSpans;
}

/**
 * Extract a ConversationTurnIO from span attributes for a given prefix.
 */
function extractIO({
  attrs,
  valueKey,
  mimeTypeKey,
}: {
  attrs: Record<string, unknown>;
  valueKey: string;
  mimeTypeKey: string;
}): ConversationTurnIO | undefined {
  const value = attrs[valueKey];
  if (value == null) return undefined;
  const io: ConversationTurnIO = { value: String(value) };
  const mimeType = attrs[mimeTypeKey];
  if (mimeType != null) {
    io.mimeType = String(mimeType);
  }
  return io;
}

/**
 * Build conversation turns from trace info and root spans, ordered by start_time.
 */
function buildConversationTurns({
  allTraceIds,
  traceInfo,
  rootSpansByTrace,
}: {
  allTraceIds: string[];
  traceInfo: Map<string, SessionTrace>;
  rootSpansByTrace: Map<string, Span>;
}): ConversationTurn[] {
  const turns: ConversationTurn[] = [];

  for (const traceId of allTraceIds) {
    const info = traceInfo.get(traceId);
    if (!info) continue;

    const turn: ConversationTurn = {
      traceId,
      startTime: info.startTime,
      endTime: info.endTime,
    };

    const rootSpan = rootSpansByTrace.get(traceId);
    if (rootSpan) {
      turn.rootSpan = rootSpan;
      const attrs = rootSpan.attributes ?? {};
      turn.input = extractIO({
        attrs,
        valueKey: SemanticConventions.INPUT_VALUE,
        mimeTypeKey: SemanticConventions.INPUT_MIME_TYPE,
      });
      turn.output = extractIO({
        attrs,
        valueKey: SemanticConventions.OUTPUT_VALUE,
        mimeTypeKey: SemanticConventions.OUTPUT_MIME_TYPE,
      });
    }

    turns.push(turn);
  }

  turns.sort((a, b) => a.startTime.localeCompare(b.startTime));
  return turns;
}
