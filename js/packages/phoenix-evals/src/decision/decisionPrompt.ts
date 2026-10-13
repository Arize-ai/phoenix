import type { ModelMessage } from "ai";

import type { WithPrompt } from "../types/prompts";

/**
 * Join a rendered AI SDK prompt into the plain-text state a decision model
 * judges. Decision models have no roles, so system text, instructions and
 * messages are joined in order.
 */
export function promptToDecisionState(prompt: WithPrompt): string {
  const parts: string[] = [];
  const { instructions, system, messages, prompt: promptContent } = prompt;
  for (const value of [instructions, system]) {
    if (value !== undefined) parts.push(instructionsToText(value));
  }
  if (typeof promptContent === "string") {
    parts.push(promptContent);
  } else if (Array.isArray(promptContent)) {
    parts.push(messagesToText(promptContent));
  }
  if (messages !== undefined) parts.push(messagesToText(messages));
  return parts.filter((part) => part.length > 0).join("\n\n");
}

function messagesToText(messages: readonly ModelMessage[]): string {
  return messages
    .map((message) => contentToText(message.content))
    .filter((text) => text.length > 0)
    .join("\n\n");
}

function instructionsToText(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    return value
      .map((item) =>
        typeof item === "object" && item !== null && "content" in item
          ? contentToText(item.content)
          : ""
      )
      .filter((text) => text.length > 0)
      .join("\n\n");
  }
  if (typeof value === "object" && value !== null && "content" in value) {
    return contentToText(value.content);
  }
  return "";
}

/**
 * Keep only the text of a message. Decision models judge text here; image
 * and file parts are not forwarded.
 */
function contentToText(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .map((part) =>
      typeof part === "object" &&
      part !== null &&
      "type" in part &&
      part.type === "text" &&
      "text" in part &&
      typeof part.text === "string"
        ? part.text
        : ""
    )
    .filter((text) => text.length > 0)
    .join("\n");
}
