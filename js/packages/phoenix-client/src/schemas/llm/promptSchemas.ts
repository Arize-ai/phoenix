import { z } from "zod";

import { jsonLiteralSchema } from "./jsonLiteralSchema";
import { findToolCallArguments, findToolCallName } from "./toolCallSchemas";
import { findToolCallId } from "./toolCallSchemas";
import { safelyStringifyJSON } from "../../utils/safelyStringifyJSON";

export const textPartSchema = z.object({
  type: z.literal("text"),
  text: z.object({
    text: z.string(),
  }),
});

export type TextPart = z.infer<typeof textPartSchema>;

export const imagePartSchema = z.object({
  type: z.literal("image"),
  image: z.object({
    url: z.string(),
  }),
});

export const toolCallPartSchema = z.object({
  type: z.literal("tool_call"),
  tool_call: z.object({
    tool_call_id: z.string(),
    tool_call: z.object({
      name: z.string(),
      arguments: z.string(),
    }),
  }),
});

export type ToolCallPart = z.infer<typeof toolCallPartSchema>;

export const toolResultPartSchema = z.object({
  type: z.literal("tool_result"),
  tool_result: z.object({
    tool_call_id: z.string(),
    result: jsonLiteralSchema,
  }),
});

export type ToolResultPart = z.infer<typeof toolResultPartSchema>;

export const promptPartSchema = z.union([
  textPartSchema,
  imagePartSchema,
  toolCallPartSchema,
  toolResultPartSchema,
]);

export type AnyPart = z.infer<typeof promptPartSchema>;

export const asTextPart = (maybePart: unknown): TextPart | null => {
  const parsed = textPartSchema.safeParse(maybePart);
  return parsed.success ? parsed.data : null;
};

export const makeTextPart = (text?: string | null) => {
  const optimisticTextPart = { text: { text } };
  const parsed = textPartSchema.safeParse(optimisticTextPart);
  return parsed.success ? parsed.data : null;
};

export const makeImagePart = (url?: string | null) => {
  const optimisticImagePart = { image: { url } };
  const parsed = imagePartSchema.safeParse(optimisticImagePart);
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
    type: "tool_call",
    tool_call: {
      tool_call_id: toolCallId,
      tool_call: {
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
