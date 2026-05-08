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
  if (hasInterruptedToolCall({ messages, errorText: USER_INTERRUPT_ERROR })) {
    return false;
  }
  if (hasInterruptedToolCall({ messages, errorText: SYSTEM_INTERRUPT_ERROR })) {
    return false;
  }
  return lastAssistantMessageIsCompleteWithToolCalls({ messages });
}

function hasInterruptedToolCall({
  messages,
  errorText,
}: {
  messages: UIMessage[];
  errorText: string;
}): boolean {
  const message = messages[messages.length - 1];
  if (!message || message.role !== "assistant") {
    return false;
  }
  return message.parts.some((part) => {
    if (!isToolUIPart(part)) {
      return false;
    }
    return part.state === "output-error" && part.errorText === errorText;
  });
}
