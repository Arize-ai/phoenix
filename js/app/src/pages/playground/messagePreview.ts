import {
  findToolCallArguments,
  findToolCallName,
} from "@phoenix/schemas/toolCallSchemas";
import type { ChatMessage } from "@phoenix/store";
import {
  toContentPreview,
  toToolCallsPreview,
} from "@phoenix/utils/contentPreviewUtils";

/**
 * A one-line excerpt of a message for its card's collapsed header, so a
 * collapsed template still reads as the conversation it is.
 *
 * Tool calls win over content, matching how the card opens: `aiMessageMode`
 * starts on tool calls whenever the message has any, so a message carrying both
 * would otherwise preview text that the expanded card never puts on screen.
 */
export function getMessagePreview(message: ChatMessage): string | undefined {
  return (
    toToolCallsPreview(
      (message.toolCalls ?? []).map((toolCall) => ({
        name: findToolCallName(toolCall),
        arguments: findToolCallArguments(toolCall),
      }))
    ) ?? toContentPreview(message.content)
  );
}
