import type { PromptChatMessagesCard__main$data } from "@phoenix/components/prompt/__generated__/PromptChatMessagesCard__main.graphql";
import {
  toContentPreview,
  toPreviewLine,
  toToolCallsPreview,
} from "@phoenix/utils/contentPreviewUtils";
import {
  asTextPart,
  asToolCallPart,
  asToolResultPart,
} from "@phoenix/utils/promptUtils";

export type ChatTemplateMessage = Extract<
  PromptChatMessagesCard__main$data["template"],
  { __typename: "PromptChatTemplate" }
>["messages"][number];

/**
 * A one-line excerpt of a template message for its card's collapsed header.
 * Prefers the message's text, then what it calls, then what a tool returned to
 * it — the same order the parts render in, so the preview is of what the reader
 * would see first on expanding the card.
 */
export function getMessagePreview(
  message: ChatTemplateMessage
): string | undefined {
  const text = message.content
    .map((part) => asTextPart(part)?.text.text)
    .filter(Boolean)
    .join(" ");
  const toolCalls = message.content
    .map((part) => asToolCallPart(part)?.toolCall.toolCall)
    .filter((toolCall) => toolCall != null);
  // Every result, not just the first: a message whose first result part is
  // blank still has something worth previewing in the ones after it
  const toolResults = message.content
    .map((part) => toPreviewLine(asToolResultPart(part)?.toolResult.result))
    .filter(Boolean)
    .join(" ");
  return (
    toContentPreview(text) ??
    toToolCallsPreview(toolCalls) ??
    toContentPreview(toolResults)
  );
}
