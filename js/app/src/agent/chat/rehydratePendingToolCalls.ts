import {
  type DynamicToolUIPart,
  getToolName,
  isDynamicToolUIPart,
  type ToolUIPart,
} from "ai";

import type { AgentToolCall } from "@phoenix/agent/extensions/toolRegistry";

import { isPendingClientToolCallPart } from "./chatUtils";
import type { AgentUIMessage, AgentUIMessagePart } from "./types";

export const PENDING_TOOL_CALL_NOT_RESTORED_ERROR =
  "This tool call can't be restored from the saved session. " +
  "Call the tool again if the action is still needed.";

/**
 * Copy a pending tool call part into its `output-error` variant.
 */
function toNotRestoredErrorPart(
  part: ToolUIPart | DynamicToolUIPart
): AgentUIMessagePart {
  const resolved = {
    toolCallId: part.toolCallId,
    title: part.title,
    toolMetadata: part.toolMetadata,
    providerExecuted: part.providerExecuted,
    state: "output-error" as const,
    input: part.input,
    errorText: PENDING_TOOL_CALL_NOT_RESTORED_ERROR,
    callProviderMetadata: part.callProviderMetadata,
  };
  return isDynamicToolUIPart(part)
    ? { ...resolved, type: "dynamic-tool", toolName: part.toolName }
    : { ...resolved, type: part.type };
}

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
      parts: message.parts.map((part) =>
        isPendingClientToolCallPart(part) &&
        staleToolCallIds.has(part.toolCallId)
          ? toNotRestoredErrorPart(part)
          : part
      ),
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
 * Partition the trailing assistant message's pending client tool calls into
 * rehydratable (safe to re-dispatch) and stale (resolve with an error).
 * In-flight calls are skipped entirely.
 */
export function partitionPendingClientToolCalls({
  messages,
  isRehydratableTool,
  isToolCallInFlight,
}: {
  messages: AgentUIMessage[];
  isRehydratableTool: (toolName: string) => boolean;
  isToolCallInFlight: (toolCallId: string) => boolean;
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
    if (isToolCallInFlight(part.toolCallId)) {
      continue;
    }
    const toolName = getToolName(part);
    const toolCall: AgentToolCall = {
      toolCallId: part.toolCallId,
      toolName,
      input: part.input,
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
