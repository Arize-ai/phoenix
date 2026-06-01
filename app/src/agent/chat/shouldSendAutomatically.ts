import {
  getToolName,
  isToolUIPart,
  lastAssistantMessageIsCompleteWithToolCalls,
  type UIMessage,
} from "ai";

import {
  EDIT_CODE_EVALUATOR_DRAFT_NAVIGATION_CANCEL_ERROR,
  EDIT_CODE_EVALUATOR_DRAFT_TOOL_NAME,
} from "@phoenix/agent/tools/codeEvaluatorDraft";
import {
  EDIT_PROMPT_NAVIGATION_CANCEL_ERROR,
  EDIT_PROMPT_TOOL_NAME,
} from "@phoenix/agent/tools/playgroundPrompt";

export const USER_INTERRUPT_ERROR = "The user has interrupted this tool call.";
export const SYSTEM_INTERRUPT_ERROR =
  "This tool call has been interrupted by unexpected system conditions.";

/**
 * Gate AI SDK's automatic tool-result continuation: most completed tool calls
 * continue, but terminal results that are local lifecycle cleanups (not model
 * input) update the transcript without continuing unprompted.
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
  if (hasPendingEditNavigationCancel(messages)) {
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
 * A pending-edit cancellation (owning route unmounted before accept/reject)
 * must not trigger an automatic follow-up — the user gave no decision.
 */
function hasPendingEditNavigationCancel(messages: UIMessage[]): boolean {
  const message = messages[messages.length - 1];
  if (!message || message.role !== "assistant") {
    return false;
  }
  return message.parts.some((part) => {
    if (!isToolUIPart(part)) {
      return false;
    }
    if (part.state !== "output-error") {
      return false;
    }
    const toolName = getToolName(part);
    return (
      (toolName === EDIT_PROMPT_TOOL_NAME &&
        part.errorText === EDIT_PROMPT_NAVIGATION_CANCEL_ERROR) ||
      (toolName === EDIT_CODE_EVALUATOR_DRAFT_TOOL_NAME &&
        part.errorText === EDIT_CODE_EVALUATOR_DRAFT_NAVIGATION_CANCEL_ERROR)
    );
  });
}
