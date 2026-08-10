import { getToolOrDynamicToolName } from "ai";

import type { AgentToolCall } from "@phoenix/agent/extensions/toolRegistry";

import { isPendingClientToolCallPart } from "./chatUtils";
import type { AgentUIMessage } from "./types";

/**
 * Error output recorded for a pending tool call whose in-memory state did not
 * survive a page reload and cannot be rebuilt from the transcript. Read by
 * both the model — which may re-propose the action — and the tool part's
 * error rendering in the chat UI.
 */
export const PENDING_TOOL_CALL_NOT_RESTORED_ERROR =
  "This tool call was awaiting client-side handling when the page reloaded, " +
  "and its pending state could not be restored from the saved conversation. " +
  "Call the tool again if the action is still needed.";

/**
 * Return a new transcript with the trailing assistant message's named tool
 * calls resolved as {@link PENDING_TOOL_CALL_NOT_RESTORED_ERROR} errors,
 * preserving inputs and metadata so they remain valid `toolOutputs`.
 */
export function resolveStalePendingToolCallParts({
  messages,
  staleToolCallIds,
}: {
  messages: AgentUIMessage[];
  staleToolCallIds: ReadonlySet<string>;
}): AgentUIMessage[] {
  if (staleToolCallIds.size === 0) {
    return messages;
  }
  return messages.map((message, index) => {
    if (index !== messages.length - 1 || message.role !== "assistant") {
      return message;
    }
    return {
      ...message,
      parts: message.parts.map((part) => {
        if (
          !isPendingClientToolCallPart(part) ||
          !staleToolCallIds.has(part.toolCallId)
        ) {
          return part;
        }
        // TS cannot narrow a spread of a union member back into the union.
        return {
          ...part,
          state: "output-error",
          errorText: PENDING_TOOL_CALL_NOT_RESTORED_ERROR,
        } as unknown as AgentUIMessage["parts"][number];
      }),
    };
  });
}

export type PartitionedPendingToolCalls = {
  /** Pending calls safe to re-dispatch to re-stage their approval state. */
  rehydratableToolCalls: AgentToolCall[];
  /**
   * Pending calls that would re-execute if re-dispatched; resolve these with
   * {@link PENDING_TOOL_CALL_NOT_RESTORED_ERROR} instead.
   */
  staleToolCalls: AgentToolCall[];
};

/**
 * Partition the trailing assistant message's unresolved client tool calls by
 * what a fresh chat can do with them after a page load: the in-memory state
 * behind pending approvals is lost on refresh, so calls of `rehydratable`
 * tools are re-dispatched to re-stage it, and every other pending call must
 * be resolved with an error or it renders as an unresolvable spinner. Only
 * the trailing message is scanned — `addToolOutput` can only resolve calls
 * there, and older pending calls are repaired server-side.
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
      // The SDK's ProviderMetadata and the registry's phoenix namespace
      // spell the same wire shape.
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
