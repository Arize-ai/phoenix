import {
  annotateSpanInputSchema,
  batchSpanAnnotateActionContextSchema,
  batchSpanAnnotateInputSchema,
} from "./schemas";
import type {
  AnnotateSpanInput,
  BatchSpanAnnotateActionContext,
  BatchSpanAnnotateInput,
} from "./types";

/**
 * Parser helpers for values that enter the batch span annotation tool from the
 * agent runtime. Each parser uses the matching Zod schema as the source of
 * truth, returns normalized typed data on success, and returns `null` for
 * invalid input so callers can ignore malformed tool payloads without handling
 * Zod errors.
 */

/**
 * Parses one annotation proposal from a raw tool payload.
 *
 * The schema accepts either a trace-local OpenTelemetry span ID or a GraphQL
 * span node ID, normalizes nullable annotation fields, and fills the default
 * annotator kind when the agent omits it.
 */
export function parseAnnotateSpanInput(
  input: unknown
): AnnotateSpanInput | null {
  return annotateSpanInputSchema.safeParse(input).data ?? null;
}

/**
 * Parses the full `batch_span_annotate` tool input.
 *
 * Successful parsing returns the normalized annotation array, not the wrapper
 * object, because downstream handlers only need the batch entries.
 */
export function parseBatchSpanAnnotateInput(
  input: unknown
): BatchSpanAnnotateInput | null {
  return batchSpanAnnotateInputSchema.safeParse(input).data ?? null;
}

/**
 * Parses the runtime-only context required to resolve a pending annotation
 * batch.
 *
 * The context is assembled by Phoenix rather than the agent model, so this
 * guards the local action plumbing: the owning tool call, session, and callback
 * used to send the eventual accept/reject output.
 */
export function parseBatchSpanAnnotateActionContext(
  input: unknown
): BatchSpanAnnotateActionContext | null {
  return batchSpanAnnotateActionContextSchema.safeParse(input).data ?? null;
}
