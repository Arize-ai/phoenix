import {
  getToolName,
  isToolUIPart,
  lastAssistantMessageIsCompleteWithToolCalls,
  type DynamicToolUIPart,
  type ToolUIPart,
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
}: {
  messages: UIMessage[];
}): boolean {
  // If tool calls were marked interrupted on message send or stream stop, do not
  // trigger another message send event.
  if (hasInterruptedToolCall({ messages, errorText: USER_INTERRUPT_ERROR })) {
    return false;
  }
  if (hasApprovalNavigationCancel(messages)) {
    return false;
  }
  return lastAssistantMessageIsCompleteWithToolCalls({ messages });
}

/**
 * The trailing assistant message's resolved client tool outputs that are
 * eligible for an eager flush to the tool-outputs endpoint — outputs the
 * server has not yet persisted, on a turn that stays open because sibling
 * tool calls are still pending. Empty when every call has resolved (the
 * normal chat continuation carries the outputs instead) or when the tail
 * holds interrupted or navigation-cancel outputs, which follow the
 * new-user-message path rather than continuing this turn.
 */
export function getFlushableClientToolOutputs({
  messages,
  isFlushed,
}: {
  messages: UIMessage[];
  /** Whether an earlier flush already persisted an output to the server. */
  isFlushed: (toolCallId: string) => boolean;
}): Array<ToolUIPart | DynamicToolUIPart> {
  const message = messages[messages.length - 1];
  if (!message || message.role !== "assistant") {
    return [];
  }
  if (hasInterruptedToolCall({ messages, errorText: USER_INTERRUPT_ERROR })) {
    return [];
  }
  if (hasApprovalNavigationCancel(messages)) {
    return [];
  }
  if (getUnresolvedToolCalls(messages).length === 0) {
    return [];
  }
  return message.parts.filter(
    (part): part is ToolUIPart | DynamicToolUIPart =>
      isResolvedClientToolOutputPart(part) && !isFlushed(part.toolCallId)
  );
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
