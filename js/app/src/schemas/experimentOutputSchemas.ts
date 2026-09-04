import { z } from "zod";

/**
 * Schema for a chat message in an experiment output.
 * Accepts any role string but we specifically look for "assistant" when extracting content.
 */
const chatMessageSchema = z.object({
  role: z.string(),
  content: z.string(),
});

export type ChatMessage = z.infer<typeof chatMessageSchema>;

/**
 * Schema for experiment outputs that contain a messages array.
 * This is the format returned by chat-based LLM experiments.
 *
 * @example
 * {
 *   "messages": [
 *     { "role": "assistant", "content": "Here is my response..." }
 *   ]
 * }
 */
export const chatMessageOutputSchema = z.object({
  messages: z.array(chatMessageSchema).min(1),
});

export type ChatMessageOutput = z.infer<typeof chatMessageOutputSchema>;

/**
 * Attempts to parse a value as a chat message output.
 * If the value is a string, it will be parsed as JSON first.
 *
 * @param value - The value to parse
 * @returns The parsed chat message output, or null if parsing fails
 */
export function parseChatMessageOutput(
  value: unknown
): ChatMessageOutput | null {
  // If it's a string, try to parse it as JSON first
  let parsedValue = value;
  if (typeof value === "string") {
    try {
      parsedValue = JSON.parse(value);
    } catch {
      return null;
    }
  }

  const result = chatMessageOutputSchema.safeParse(parsedValue);
  if (result.success) {
    return result.data;
  }
  return null;
}

/**
 * Extracts the content from the last assistant message in a chat message output.
 *
 * @param output - The chat message output
 * @returns The content of the last assistant message, or null if none found
 */
export function extractAssistantContent(
  output: ChatMessageOutput
): string | null {
  // Find the last assistant message
  const assistantMessages = output.messages.filter(
    (msg) => msg.role === "assistant"
  );

  if (assistantMessages.length === 0) {
    return null;
  }

  // Return the content of the last assistant message
  return assistantMessages[assistantMessages.length - 1].content;
}
