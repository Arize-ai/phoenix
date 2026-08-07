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
  EDIT_LLM_EVALUATOR_DRAFT_NAVIGATION_CANCEL_ERROR,
  EDIT_LLM_EVALUATOR_DRAFT_TOOL_NAME,
} from "@phoenix/agent/tools/llmEvaluatorDraft";
import {
  EDIT_PROMPT_NAVIGATION_CANCEL_ERROR,
  EDIT_PROMPT_TOOL_NAME,
  REMOVE_PROMPT_INSTANCE_NAVIGATION_CANCEL_ERROR,
  REMOVE_PROMPT_INSTANCE_TOOL_NAME,
} from "@phoenix/agent/tools/playgroundPrompt";

import { isResolvedClientToolOutputPart } from "./chatUtils";
import { getUnresolvedToolCalls } from "./interruptToolCalls";

export const USER_INTERRUPT_ERROR = "The user has interrupted this tool call.";

// The AI SDK auto-continues after completed tool calls; suppress that when the last result is a local lifecycle cleanup, not model input.
export function shouldSendAutomaticallyAfterToolOutput({
  messages,
  isToolOutputSubmitted,
}: {
  messages: UIMessage[];
  /**
   * Whether a resolved client tool output already reached the server in an
   * earlier request of this turn. When provided, each newly resolved output
   * triggers a send even while sibling tool calls are still pending — the
   * server persists the partial outputs and yields the turn back. Without it
   * partial sends are disabled (they would re-trigger forever), and the turn
   * only continues once every tool call resolves.
   */
  isToolOutputSubmitted?: (toolCallId: string) => boolean;
}): boolean {
  // If tool calls were marked interrupted on message send or stream stop, do not
  // trigger another message send event.
  if (hasInterruptedToolCall({ messages, errorText: USER_INTERRUPT_ERROR })) {
    return false;
  }
  if (hasApprovalNavigationCancel(messages)) {
    return false;
  }
  if (lastAssistantMessageIsCompleteWithToolCalls({ messages })) {
    return true;
  }
  if (!isToolOutputSubmitted) {
    return false;
  }
  return hasUnsubmittedClientToolOutput({ messages, isToolOutputSubmitted });
}

export function shouldKeepTurnOpenForPendingToolOutput({
  messages,
  shouldSendAutomatically,
}: {
  messages: UIMessage[];
  shouldSendAutomatically: boolean;
}): boolean {
  return (
    !shouldSendAutomatically && getUnresolvedToolCalls(messages).length > 0
  );
}

/**
 * Whether the trailing assistant message holds a resolved client tool output
 * the server has not yet persisted — the trigger for flushing partial outputs
 * (e.g. the first of several approvals) to the chat route while sibling calls
 * are still pending.
 */
function hasUnsubmittedClientToolOutput({
  messages,
  isToolOutputSubmitted,
}: {
  messages: UIMessage[];
  isToolOutputSubmitted: (toolCallId: string) => boolean;
}): boolean {
  const message = messages[messages.length - 1];
  if (!message || message.role !== "assistant") {
    return false;
  }
  return message.parts.some(
    (part) =>
      isResolvedClientToolOutputPart(part) &&
      !isToolOutputSubmitted(part.toolCallId)
  );
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

function hasApprovalNavigationCancel(messages: UIMessage[]): boolean {
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
      (toolName === REMOVE_PROMPT_INSTANCE_TOOL_NAME &&
        part.errorText === REMOVE_PROMPT_INSTANCE_NAVIGATION_CANCEL_ERROR) ||
      (toolName === EDIT_CODE_EVALUATOR_DRAFT_TOOL_NAME &&
        part.errorText === EDIT_CODE_EVALUATOR_DRAFT_NAVIGATION_CANCEL_ERROR) ||
      (toolName === EDIT_LLM_EVALUATOR_DRAFT_TOOL_NAME &&
        part.errorText === EDIT_LLM_EVALUATOR_DRAFT_NAVIGATION_CANCEL_ERROR)
    );
  });
}
