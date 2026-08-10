import { getToolOrDynamicToolName } from "ai";

import type { AgentToolCall } from "@phoenix/agent/extensions/toolRegistry";

import { isPendingClientToolCallPart } from "./chatUtils";
import type { AgentUIMessage } from "./types";

/**
 * Error output recorded for a pending tool call whose in-memory state (a
 * mounted surface's client action, an unstaged approval) did not survive a
 * page reload and cannot be rebuilt from the transcript. Read by both the
 * model — which may re-propose the action — and the tool part's error
 * rendering in the chat UI.
 */
export const PENDING_TOOL_CALL_NOT_RESTORED_ERROR =
  "This tool call was awaiting client-side handling when the page reloaded, " +
  "and its pending state could not be restored from the saved conversation. " +
  "Call the tool again if the action is still needed.";

export type PartitionedPendingToolCalls = {
  /**
   * Pending calls of tools whose dispatch only stages approval state —
   * re-dispatch these through the normal tool-call path to restore their
   * Accept/Reject affordances.
   */
  rehydratableToolCalls: AgentToolCall[];
  /**
   * Pending calls of tools that execute on dispatch (reads, client actions):
   * re-dispatching would re-run them, and their pending UI state is
   * unrecoverable — resolve these with
   * {@link PENDING_TOOL_CALL_NOT_RESTORED_ERROR} so the turn can proceed
   * instead of spinning forever.
   */
  staleToolCalls: AgentToolCall[];
};

/**
 * Partition the seeded tail's unresolved client tool calls by what a freshly
 * created chat can do with them after a page load.
 *
 * Pending tool affordances (inline Accept/Reject cards, elicitation prompts)
 * live in in-memory store state created when the tool call was dispatched
 * during a live stream, so a refresh loses them even though the unresolved
 * call — id, name, and full input — is persisted in the transcript. Calls of
 * tools whose registry definition declares `rehydratable` can be safely
 * re-dispatched to re-stage that state; every other pending call is stale and
 * must be resolved with an error, or it renders as an unresolvable spinner
 * and the server keeps the turn open forever.
 *
 * Only the trailing assistant message is scanned: `addToolOutput` can only
 * resolve calls there, and older pending calls are repaired server-side.
 */
export function partitionPendingClientToolCalls({
  messages,
  isRehydratableTool,
}: {
  messages: AgentUIMessage[];
  /** Whether the named tool's dispatch is a pure approval-staging step. */
  isRehydratableTool: (toolName: string) => boolean;
}): PartitionedPendingToolCalls {
  const rehydratableToolCalls: AgentToolCall[] = [];
  const staleToolCalls: AgentToolCall[] = [];
  const message = messages[messages.length - 1];
  if (!message || message.role !== "assistant") {
    return { rehydratableToolCalls, staleToolCalls };
  }
  for (const part of message.parts) {
    if (!isPendingClientToolCallPart(part)) {
      continue;
    }
    const toolName = getToolOrDynamicToolName(part);
    const toolCall: AgentToolCall = {
      toolCallId: part.toolCallId,
      toolName,
      input: part.input,
      // Validated structurally by isPendingClientToolCallPart; the SDK's
      // ProviderMetadata and the registry's phoenix namespace spell the same
      // wire shape.
      providerMetadata:
        part.callProviderMetadata as AgentToolCall["providerMetadata"],
    };
    if (isRehydratableTool(toolName)) {
      rehydratableToolCalls.push(toolCall);
    } else {
      staleToolCalls.push(toolCall);
    }
  }
  return { rehydratableToolCalls, staleToolCalls };
}
