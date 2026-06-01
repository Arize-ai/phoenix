import { isTextUIPart, isToolUIPart } from "ai";

import type { AgentUIMessage } from "./types";

/**
 * The outcome of truncating a transcript at a chosen message. Used by both the
 * in-place rewind and the fork-into-new-session flows so the two paths share a
 * single, well-tested truncation contract.
 */
export type RewindResult = {
  /**
   * The transcript that should replace the current one. For an assistant
   * target this still contains the chosen assistant turn; for a user target
   * the chosen user turn (and everything after it) is removed.
   */
  messages: AgentUIMessage[];
  /**
   * Text that should be placed back into the prompt input. Populated only when
   * rewinding/forking from a user message so the user can edit and re-send it.
   * `null` for assistant targets, where no input is restored.
   */
  restoredInput: string | null;
};

/**
 * Concatenates the text parts of a message into the string a human typed/read.
 * Non-text parts (tool calls, generative UI) are ignored.
 */
function getMessageText(message: AgentUIMessage): string {
  return message.parts
    .filter(isTextUIPart)
    .map((part) => part.text)
    .join("");
}

/**
 * Strips tool-call parts that never reached a terminal output state. Rewinding
 * to an assistant turn must not leave dangling/pending tool calls behind, both
 * because the UI would show stale approval affordances and because Anthropic
 * rejects requests that contain unresolved tool calls.
 */
function removePendingToolParts(message: AgentUIMessage): AgentUIMessage {
  return {
    ...message,
    parts: message.parts.filter((part) => {
      if (!isToolUIPart(part)) {
        return true;
      }
      return (
        part.state === "output-available" ||
        part.state === "output-error" ||
        part.state === "output-denied"
      );
    }),
  };
}

/**
 * Computes the transcript that results from rewinding (or forking) at the
 * message with the given id.
 *
 * - **Assistant target**: keep everything up to and including the chosen
 *   assistant message, clearing any pending tool calls on that turn. The chat
 *   is reverted to the state it was in when that response completed.
 * - **User target**: remove the chosen user message and everything after it,
 *   and return its text as `restoredInput` so the caller can repopulate the
 *   prompt input for editing/re-sending.
 *
 * Returns `null` when the id is not found, so callers can no-op safely.
 */
export function rewindMessages({
  messages,
  messageId,
}: {
  messages: AgentUIMessage[];
  messageId: string;
}): RewindResult | null {
  const targetIndex = messages.findIndex((message) => message.id === messageId);
  if (targetIndex === -1) {
    return null;
  }

  const target = messages[targetIndex]!;

  if (target.role === "user") {
    return {
      messages: messages.slice(0, targetIndex),
      restoredInput: getMessageText(target),
    };
  }

  const retained = messages.slice(0, targetIndex + 1);
  return {
    messages: retained.map((message, index) =>
      index === targetIndex ? removePendingToolParts(message) : message
    ),
    restoredInput: null,
  };
}
