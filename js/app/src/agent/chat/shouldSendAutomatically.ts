import {
  isToolUIPart,
  lastAssistantMessageIsCompleteWithToolCalls,
  type UIMessage,
} from "ai";

import { isRecord } from "@phoenix/utils/typeUtils";

import {
  isResolvedClientToolOutputPart,
  type ResolvedToolOutputPart,
} from "./chatUtils";
import { getUnresolvedToolCalls } from "./interruptToolCalls";

export const USER_INTERRUPT_ERROR = "The user has interrupted this tool call.";

export type LocallyInterruptedToolCallIds = Partial<Record<string, true>>;

// The AI SDK auto-continues after completed tool calls; suppress that when the last result is a local lifecycle cleanup, not model input.
export function shouldSendAutomaticallyAfterToolOutput({
  messages,
  locallyInterruptedToolCallIds,
}: {
  messages: UIMessage[];
  locallyInterruptedToolCallIds: LocallyInterruptedToolCallIds;
}): boolean {
  if (hasInterruptedToolCall({ messages, locallyInterruptedToolCallIds })) {
    return false;
  }
  return lastAssistantMessageIsCompleteWithToolCalls({ messages });
}

/**
 * Resolved client tool outputs on a message whose sibling tool calls are
 * still pending. May include outputs the server already persisted.
 */
export function getFlushableClientToolOutputs({
  message,
  locallyInterruptedToolCallIds,
}: {
  /** The transcript's trailing assistant message. */
  message: UIMessage;
  locallyInterruptedToolCallIds: LocallyInterruptedToolCallIds;
}): ResolvedToolOutputPart[] {
  if (message.role !== "assistant") {
    return [];
  }
  const messages = [message];
  if (hasInterruptedToolCall({ messages, locallyInterruptedToolCallIds })) {
    return [];
  }
  if (getUnresolvedToolCalls(messages).length === 0) {
    return [];
  }
  return message.parts.filter((part) => isResolvedClientToolOutputPart(part));
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
 * Whether a resolved tool part was closed out by a lifecycle cleanup rather
 * than a real result: marked in {@link LocallyInterruptedToolCallIds} by this
 * client, or persisted with `phoenix.outcome = "interrupted"`.
 */
export function isInterruptedToolCallPart({
  part,
  locallyInterruptedToolCallIds,
}: {
  part: UIMessage["parts"][number];
  locallyInterruptedToolCallIds: LocallyInterruptedToolCallIds;
}): boolean {
  if (!isToolUIPart(part)) {
    return false;
  }
  if (part.state !== "output-error" && part.state !== "output-available") {
    return false;
  }
  return (
    locallyInterruptedToolCallIds[part.toolCallId] === true ||
    hasPersistedInterruptedOutcome(part)
  );
}

/** The durable form of an interrupted mark: the outcome stamped on the part. */
function hasPersistedInterruptedOutcome(part: {
  callProviderMetadata?: unknown;
}): boolean {
  const phoenixMetadata: unknown = isRecord(part.callProviderMetadata)
    ? part.callProviderMetadata.phoenix
    : null;
  return isRecord(phoenixMetadata) && phoenixMetadata.outcome === "interrupted";
}

function hasInterruptedToolCall({
  messages,
  locallyInterruptedToolCallIds,
}: {
  messages: UIMessage[];
  locallyInterruptedToolCallIds: LocallyInterruptedToolCallIds;
}): boolean {
  const message = messages[messages.length - 1];
  if (!message || message.role !== "assistant") {
    return false;
  }
  return message.parts.some((part) =>
    isInterruptedToolCallPart({ part, locallyInterruptedToolCallIds })
  );
}
