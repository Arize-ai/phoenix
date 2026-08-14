import {
  getToolName,
  isToolUIPart,
  type DynamicToolUIPart,
  type UIMessage,
} from "ai";

import { assertUnreachable } from "@phoenix/typeUtils";

export type UnresolvedToolCall = {
  tool: string;
  toolCallId: string;
};

/**
 * Finds tool calls that have not reached a terminal output state on the last
 * assistant turn. AI SDK's `addToolOutput` only updates the current last
 * message, so older assistant turns are intentionally ignored here.
 */
export function getUnresolvedToolCalls(
  messages: UIMessage[]
): UnresolvedToolCall[] {
  const message = messages[messages.length - 1];
  if (!message || message.role !== "assistant") {
    return [];
  }

  return message.parts
    .filter(isToolUIPart)
    .filter(
      (part) => !part.providerExecuted && isUnresolvedToolState(part.state)
    )
    .map((part) => ({
      tool: getToolName(part),
      toolCallId: part.toolCallId,
    }));
}

function isUnresolvedToolState(state: DynamicToolUIPart["state"]): boolean {
  switch (state) {
    case "input-streaming":
    case "input-available":
    case "approval-requested":
    case "approval-responded":
      return true;
    case "output-available":
    case "output-error":
    case "output-denied":
      return false;
    default:
      return assertUnreachable(state);
  }
}
