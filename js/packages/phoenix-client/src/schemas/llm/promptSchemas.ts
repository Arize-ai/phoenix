import { z } from "zod";

import { jsonLiteralSchema } from "./jsonLiteralSchema";
import { findToolCallArguments, findToolCallName } from "./toolCallSchemas";
import { findToolCallId } from "./toolCallSchemas";
import { safelyStringifyJSON } from "../../utils/safelyStringifyJSON";

export const textPartSchema = z.object({
  text: z.object({
    text: z.string(),
  }),
});

export type TextPart = z.infer<typeof textPartSchema>;

export const toolCallPartSchema = z.object({
  toolCall: z.object({
    toolCallId: z.string(),
    toolCall: z.object({
      name: z.string(),
      arguments: z.string(),
    }),
  }),
});

export type ToolCallPart = z.infer<typeof toolCallPartSchema>;

export const toolResultPartSchema = z.object({
  toolResult: z.object({
    toolCallId: z.string(),
    result: jsonLiteralSchema,
  }),
});

export type ToolResultPart = z.infer<typeof toolResultPartSchema>;

export type AnyPart = TextPart | ToolCallPart | ToolResultPart;

export const asTextPart = (maybePart: unknown): TextPart | null => {
  const parsed = textPartSchema.safeParse(maybePart);
  return parsed.success ? parsed.data : null;
};

export const makeTextPart = (text?: string | null) => {
  const optimisticTextPart = { text: { text } };
  const parsed = textPartSchema.safeParse(optimisticTextPart);
  return parsed.success ? parsed.data : null;
};

export const asToolCallPart = (maybePart: unknown): ToolCallPart | null => {
  const parsed = toolCallPartSchema.safeParse(maybePart);
  return parsed.success ? parsed.data : null;
};

export const makeToolCallPart = (maybeToolCall: unknown) => {
  // detect if maybeToolCall is an object with an id, or a string that can be parsed into an object with an id
  const toolCallId = findToolCallId(maybeToolCall);
  const toolCallName = findToolCallName(maybeToolCall);
  const toolCallArguments = findToolCallArguments(maybeToolCall);
  if (!toolCallId) {
    return null;
  }
  const safelyStringifiedArguments =
    safelyStringifyJSON(toolCallArguments).json || "";
  // then, parse it into the optimistic tool call part shape
  const optimisticToolCallPart: ToolCallPart = {
    toolCall: {
      toolCallId,
      toolCall: {
        name: toolCallName || toolCallId,
        arguments: safelyStringifiedArguments,
      },
    },
  };
  const parsed = toolCallPartSchema.safeParse(optimisticToolCallPart);
  return parsed.success ? parsed.data : null;
};

export const asToolResultPart = (maybePart: unknown): ToolResultPart | null => {
  const parsed = toolResultPartSchema.safeParse(maybePart);
  return parsed.success ? parsed.data : null;
};

export const makeToolResultPart = (
  toolCallId?: string | null,
  result?: unknown
) => {
  const optimisticToolResultPart = { toolResult: { toolCallId, result } };
  const parsed = toolResultPartSchema.safeParse(optimisticToolResultPart);
  return parsed.success ? parsed.data : null;
};
