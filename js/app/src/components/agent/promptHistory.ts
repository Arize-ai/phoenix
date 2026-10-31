import { isTextUIPart } from "ai";

import type { AgentUIMessage } from "@phoenix/agent/chat/types";
import { isCompactionMessage } from "@phoenix/agent/chat/types";

/**
 * Previously sent prompts for the up-arrow recall, newest first.
 *
 * Derived from the session's user messages rather than stored separately, so
 * it covers server-hydrated sessions and follows rewinds. Consecutive repeats
 * collapse into one entry.
 */
export function getPromptHistory(messages: AgentUIMessage[]): string[] {
  const history: string[] = [];
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    if (message.role !== "user" || isCompactionMessage(message)) {
      continue;
    }
    const text = message.parts
      .filter(isTextUIPart)
      .map((part) => part.text)
      .join("")
      .trim();
    if (text && text !== history[history.length - 1]) {
      history.push(text);
    }
  }
  return history;
}

/**
 * Compute the result of pressing ArrowUp/ArrowDown in the prompt, or null when
 * the key should keep its default caret behavior.
 *
 * Cycling starts only from an empty input, so a draft is never replaced. The
 * user stays in cycling mode only while the input still holds the recalled
 * entry; any edit ends it. Stepping down past the newest entry clears the
 * input. Caret placement (first/last line) is checked by the caller.
 */
export function stepPromptHistory({
  history,
  index,
  value,
  direction,
}: {
  history: string[];
  index: number | null;
  value: string;
  direction: "older" | "newer";
}): { index: number | null; value: string } | null {
  const isCycling = index !== null && history[index] === value;
  if (direction === "older") {
    if (!isCycling && value !== "") {
      return null;
    }
    const nextIndex = isCycling ? index + 1 : 0;
    if (nextIndex >= history.length) {
      return null;
    }
    return { index: nextIndex, value: history[nextIndex] };
  }
  if (!isCycling) {
    return null;
  }
  if (index === 0) {
    return { index: null, value: "" };
  }
  return { index: index - 1, value: history[index - 1] };
}

export function isCaretOnFirstLine(
  value: string,
  selectionStart: number,
  selectionEnd: number
): boolean {
  return (
    selectionStart === selectionEnd &&
    !value.slice(0, selectionStart).includes("\n")
  );
}

export function isCaretOnLastLine(
  value: string,
  selectionStart: number,
  selectionEnd: number
): boolean {
  return (
    selectionStart === selectionEnd && !value.slice(selectionEnd).includes("\n")
  );
}
