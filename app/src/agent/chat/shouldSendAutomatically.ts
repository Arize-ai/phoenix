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
  // The SDK completeness helper only inspects tool parts after the last
  // `step-start` and treats a narrower set of states as terminal, so it can
  // miss unresolved approvals or client tools elsewhere in the trailing
  // assistant message. Never auto-send while any tool call is unresolved.
  if (getUnresolvedToolCalls(messages).length > 0) {
    return false;
  }
  return lastAssistantMessageIsCompleteWithToolCalls({ messages });
}

/**
 * Whether the turn must stay open because tool calls on the trailing
 * assistant message still await feedback. Uses the same
 * `getUnresolvedToolCalls` predicate as the auto-send gate above, so the two
 * cannot disagree: any unresolved call both suppresses the send and keeps
 * the turn open.
 */
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
