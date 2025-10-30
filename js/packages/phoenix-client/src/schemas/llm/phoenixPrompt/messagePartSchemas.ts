import type { PromptChatMessagePart } from "../../../types/prompts";
import { schemaMatches } from "../../../utils/schemaMatches";

import z from "zod";

export const textPartSchema = schemaMatches<
  Extract<PromptChatMessagePart, { type: "text" }>
>()(
  z.object({
    type: z.literal("text"),
    text: z.string(),
  })
);

export type TextPart = z.infer<typeof textPartSchema>;

export const toolCallPartSchema = schemaMatches<
  Extract<PromptChatMessagePart, { type: "tool_call" }>
>()(
  z.object({
    type: z.literal("tool_call"),
    tool_call_id: z.string(),
    tool_call: z.object({
      type: z.literal("function"),
      name: z.string(),
      arguments: z.string(),
    }),
  })
);

export type ToolCallPart = z.infer<typeof toolCallPartSchema>;

export const toolResultPartSchema = schemaMatches<
  Extract<PromptChatMessagePart, { type: "tool_result" }>
>()(
  z.object({
    type: z.literal("tool_result"),
    tool_call_id: z.string(),
    tool_result: z.union([
      z.string(),
      z.number(),
      z.boolean(),
      z.null(),
      z.record(z.unknown()),
      z.array(z.unknown()),
    ]),
  })
);

export type ToolResultPart = z.infer<typeof toolResultPartSchema>;

export const phoenixContentPartSchema = schemaMatches<PromptChatMessagePart>()(
  z.discriminatedUnion("type", [
    textPartSchema,
    toolCallPartSchema,
    toolResultPartSchema,
  ])
);

export type PhoenixContentPart = z.infer<typeof phoenixContentPartSchema>;

/*
 *
 * Creation helpers
 *
 */

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
