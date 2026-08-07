/**
 * Tracks which resolved client tool outputs the server has already persisted,
 * so the send decision can flush each newly resolved output to the chat route
 * without re-triggering on outputs a prior continuation already delivered.
 *
 * The chat route applies `toolOutputs` idempotently (already-resolved calls
 * are ignored), so this tracking exists to stop the automatic-send loop — the
 * AI SDK re-evaluates `sendAutomaticallyWhen` after every request, and a
 * resolved-but-pending-sibling tool part would otherwise look sendable
 * forever — not to keep duplicates off the wire.
 *
 * Lifecycle: the outputs carried by an outgoing request are recorded as
 * in-flight when the request body is built, committed as submitted when the
 * stream's `data-transcript-persisted` acknowledgement confirms the server
 * persisted them, and discarded (left resendable) if the request errors.
 */
export function createSubmittedToolOutputTracker() {
  const submittedToolCallIds = new Set<string>();
  let inFlightToolCallIds: string[] = [];

  return {
    /** Record the tool call ids an outgoing request is carrying as outputs. */
    recordRequest: (toolCallIds: string[]): void => {
      inFlightToolCallIds = toolCallIds;
    },
    /** The server acknowledged persisting the in-flight request's outputs. */
    commitInFlight: (): void => {
      for (const toolCallId of inFlightToolCallIds) {
        submittedToolCallIds.add(toolCallId);
      }
      inFlightToolCallIds = [];
    },
    /** The in-flight request failed; leave its outputs eligible for resend. */
    discardInFlight: (): void => {
      inFlightToolCallIds = [];
    },
    /** Reset all tracking when the logical turn completes. */
    clear: (): void => {
      submittedToolCallIds.clear();
      inFlightToolCallIds = [];
    },
    /** Whether this output already reached the server in an earlier request. */
    isSubmitted: (toolCallId: string): boolean =>
      submittedToolCallIds.has(toolCallId),
  };
}

export type SubmittedToolOutputTracker = ReturnType<
  typeof createSubmittedToolOutputTracker
>;
