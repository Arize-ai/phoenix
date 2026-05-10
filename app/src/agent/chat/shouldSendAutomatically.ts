import {
  getToolName,
  isToolUIPart,
  lastAssistantMessageIsCompleteWithToolCalls,
  type UIMessage,
} from "ai";

import {
  EDIT_PROMPT_NAVIGATION_CANCEL_ERROR,
  EDIT_PROMPT_TOOL_NAME,
} from "@phoenix/agent/tools/playgroundPrompt";

export const USER_INTERRUPT_ERROR = "The user has interrupted this tool call.";
export const SYSTEM_INTERRUPT_ERROR =
  "This tool call has been interrupted by unexpected system conditions.";

/**
 * Gate AI SDK's automatic tool-result continuation.
 *
 * `addToolOutput` always asks `sendAutomaticallyWhen` whether it should submit
 * the next model request. Most completed tool calls should continue via AI
 * SDK's `lastAssistantMessageIsCompleteWithToolCalls` helper. Some terminal
 * tool results are local lifecycle cleanups rather than actionable results for
 * the model, so they should update the transcript without making PXI continue
 * unprompted.
 */
export function shouldSendAutomaticallyAfterToolOutput({
  messages,
}: {
  messages: UIMessage[];
}): boolean {
  // If tool calls were marked interrupted on message send or stream stop, do not
  // trigger another message send event.
  if (hasInterruptedToolCall({ messages, errorText: USER_INTERRUPT_ERROR })) {
    return false;
  }
  if (hasInterruptedToolCall({ messages, errorText: SYSTEM_INTERRUPT_ERROR })) {
    return false;
  }
  if (hasPromptEditNavigationCancel(messages)) {
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

/**
 * Detects the `edit_prompt_instance` lifecycle cancellation emitted when the
 * playground route unmounts before the user accepts or rejects a proposed prompt
 * edit. This terminal tool result is useful for the transcript, but it should
 * not trigger an automatic follow-up model request because the user did not
 * provide an approval decision or a new instruction.
 */
function hasPromptEditNavigationCancel(messages: UIMessage[]): boolean {
  const message = messages[messages.length - 1];
  if (!message || message.role !== "assistant") {
    return false;
  }
  return message.parts.some((part) => {
    if (!isToolUIPart(part)) {
      return false;
    }
    return (
      getToolName(part) === EDIT_PROMPT_TOOL_NAME &&
      part.state === "output-error" &&
      part.errorText === EDIT_PROMPT_NAVIGATION_CANCEL_ERROR
    );
  });
}
