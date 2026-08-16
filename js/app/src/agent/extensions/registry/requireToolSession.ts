import type { AddToolOutput, AgentToolCall } from "./defineTool";

/**
 * Shared session guard for tools that cannot run without an active session.
 *
 * Requiring a session is orthogonal to whether a tool delegates to a page
 * action: both `defineClientActionTool` (via its `requireSession` knob) and
 * standalone `defineTool` tools (`ask_user`, `batch_span_annotate`) compose this
 * guard instead of hand-rolling the same check. Returns the non-null session id,
 * or emits an `output-error` and returns `null` so the caller can bail.
 *
 * @param params.toolName - server-advertised tool name (for the error payload)
 * @param params.toolCall - the originating tool call
 * @param params.sessionId - the current session id, or null when absent
 * @param params.addToolOutput - AI SDK callback used to surface the error
 * @param params.errorText - tool-specific "no active session" message
 */
export async function requireToolSession({
  toolName,
  toolCall,
  sessionId,
  addToolOutput,
  errorText,
}: {
  toolName: string;
  toolCall: AgentToolCall;
  sessionId: string | null;
  addToolOutput: AddToolOutput;
  errorText: string;
}): Promise<string | null> {
  if (sessionId != null) {
    return sessionId;
  }
  await addToolOutput({
    state: "output-error",
    tool: toolName,
    toolCallId: toolCall.toolCallId,
    errorText,
  });
  return null;
}
