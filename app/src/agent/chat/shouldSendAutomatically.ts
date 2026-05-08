import {
  isToolUIPart,
  lastAssistantMessageIsCompleteWithToolCalls,
  type UIMessage,
} from "ai";

export const USER_INTERRUPT_ERROR = "The user has interrupted this tool call.";
export const SYSTEM_INTERRUPT_ERROR =
  "This tool call has been interrupted by unexpected system conditions.";

/**
 * Gate AI SDK's automatic tool-result continuation.
 *
 * `addToolOutput` always asks `sendAutomaticallyWhen` whether it should submit
 * the next model request. Most completed tool calls should continue via AI
 * SDK's `lastAssistantMessageIsCompleteWithToolCalls` helper. Some UI-owned
 * tools, however, can complete because the live UI surface disappeared rather
 * than because the user finished the requested action. Those terminal results
 * should update the transcript, but should not make PXI continue unprompted.
 *
 * Extend this by adding narrow predicates for other terminal tool outputs that
 * are UX/lifecycle cancellations rather than actionable results for the model.
 */
export function shouldSendAutomaticallyAfterToolOutput({
  messages,
}: {
  messages: UIMessage[];
}): boolean {
  // if we just marked tool calls as interrupted (on message send or stream stop), we don't
  // want to trigger another message send event
  if (hasUserInterruptedToolCall(messages)) {
    return false;
  }
  if (hasSystemInterruptedToolCall(messages)) {
    return false;
  }
  return lastAssistantMessageIsCompleteWithToolCalls({ messages });
}

function hasUserInterruptedToolCall(messages: UIMessage[]): boolean {
  const message = messages[messages.length - 1];
  if (!message || message.role !== "assistant") {
    return false;
  }
  return message.parts.some((part) => {
    if (!isToolUIPart(part)) {
      return false;
    }
    return (
      part.state === "output-error" && part.errorText === USER_INTERRUPT_ERROR
    );
  });
}

// we don't want to send automatically after we've set a synthetic tool error
function hasSystemInterruptedToolCall(messages: UIMessage[]): boolean {
  const message = messages[messages.length - 1];
  if (!message || message.role !== "assistant") {
    return false;
  }
  return message.parts.some((part) => {
    if (!isToolUIPart(part)) {
      return false;
    }
    return (
      part.state === "output-error" && part.errorText === SYSTEM_INTERRUPT_ERROR
    );
  });
}
