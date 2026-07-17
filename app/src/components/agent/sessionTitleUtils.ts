import { isTextUIPart, type UIMessage } from "ai";

const MAX_TITLE_LENGTH = 50;

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

export const EMPTY_SESSION_DISPLAY_NAME = "New chat";

/** Prefix applied to a branched session's title to denote its origin. */
const FORK_TITLE_PREFIX = "(branch) ";

/**
 * Builds the title for a session branched from a source conversation. Reuses
 * the source's LLM-generated title when available, otherwise derives a short
 * label from the branch's first user message, then prefixes it with
 * `(branch)`. Seeding a non-empty title here also prevents the async
 * summarizer from overwriting it.
 */
export function buildForkTitle({
  title,
  messages,
}: {
  title: string;
  messages: UIMessage[];
}): string {
  let base = title.trim();
  if (!base) {
    const firstMessage = getFirstUserMessageText(messages);
    base = firstMessage
      ? firstMessage.length > MAX_TITLE_LENGTH
        ? `${firstMessage.slice(0, MAX_TITLE_LENGTH)}...`
        : firstMessage
      : "";
  }
  // Avoid stacking "(branch) (branch) ..." when branching from a branch.
  if (base.startsWith(FORK_TITLE_PREFIX)) {
    return base;
  }
  return base ? `${FORK_TITLE_PREFIX}${base}` : FORK_TITLE_PREFIX.trim();
}

/**
 * Derives the display name for a session using a cascading strategy:
 * 1. LLM-generated `title` (set asynchronously after first exchange)
 * 2. Truncated first user message
 * 3. Hardcoded "New chat" fallback
 */
export function getSessionDisplayName({
  title,
  messages,
}: {
  title: string;
  messages: UIMessage[];
}): string {
  if (title) return title;

  const firstMessage = getFirstUserMessageText(messages);
  if (firstMessage) {
    return firstMessage.length > MAX_TITLE_LENGTH
      ? `${firstMessage.slice(0, MAX_TITLE_LENGTH)}...`
      : firstMessage;
  }

  return EMPTY_SESSION_DISPLAY_NAME;
}
