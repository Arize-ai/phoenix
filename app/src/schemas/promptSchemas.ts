import { z } from "zod";

import { jsonLiteralSchema } from "@phoenix/schemas/jsonLiteralSchema";

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
