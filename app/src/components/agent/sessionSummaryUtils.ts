import { isTextUIPart, type UIMessage } from "ai";

const MAX_SUMMARY_LENGTH = 50;

/**
 * Extracts the text content from the first user message in a conversation.
 * Returns the concatenated text parts, or `null` if no user message exists.
 */
export function getFirstUserMessageText(messages: UIMessage[]): string | null {
  const firstUserMessage = messages.find((message) => message.role === "user");
  if (!firstUserMessage) return null;

  const textContent = firstUserMessage.parts
    .filter(isTextUIPart)
    .map((part) => part.text)
    .join(" ")
    .trim();

  return textContent || null;
}

/**
 * Extracts the text content from the first assistant message, filtering out
 * tool call parts to keep token usage low when used for summary generation.
 * Returns `null` if no assistant message with text exists.
 */
export function getFirstAssistantMessageText(
  messages: UIMessage[]
): string | null {
  const firstAssistantMessage = messages.find(
    (message) => message.role === "assistant"
  );
  if (!firstAssistantMessage) return null;

  const textContent = firstAssistantMessage.parts
    .filter(isTextUIPart)
    .map((part) => part.text)
    .join(" ")
    .trim();

  return textContent || null;
}

export const EMPTY_SESSION_DISPLAY_NAME = "New chat";

/**
 * Derives the display name for a session using a cascading strategy:
 * 1. LLM-generated `shortSummary` (set asynchronously after first exchange)
 * 2. Truncated first user message
 * 3. Hardcoded "New chat" fallback
 */
export function getSessionDisplayName({
  shortSummary,
  messages,
}: {
  shortSummary: string;
  messages: UIMessage[];
}): string {
  if (shortSummary) return shortSummary;

  const firstMessage = getFirstUserMessageText(messages);
  if (firstMessage) {
    return firstMessage.length > MAX_SUMMARY_LENGTH
      ? `${firstMessage.slice(0, MAX_SUMMARY_LENGTH)}...`
      : firstMessage;
  }

  return EMPTY_SESSION_DISPLAY_NAME;
}
