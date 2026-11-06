import { isTextUIPart } from "ai";

import {
  isCompactionMessage,
  type AgentUIMessage,
} from "@phoenix/agent/chat/types";

/**
 * The text of the user message a rewind/branch at `messageId` removes, or null
 * when the target is not an ordinary user message. Assistant responses and
 * synthetic compaction checkpoints are retained without staging composer text.
 */
export function getRemovedUserMessageText(
  messages: AgentUIMessage[],
  messageId: string
): string | null {
  const target = messages.find((message) => message.id === messageId);
  if (!target || target.role !== "user" || isCompactionMessage(target)) {
    return null;
  }
  return target.parts
    .filter(isTextUIPart)
    .map((part) => part.text)
    .join("");
}
