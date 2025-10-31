import { anthropicToolCallSchema } from "./toolCallSchemas";

import z from "zod";

/*
 *
 * Anthropic Message Part Schemas
 *
 */

export const anthropicTextBlockSchema = z.object({
  type: z.literal("text"),
  text: z.string(),
});

export type AnthropicTextBlock = z.infer<typeof anthropicTextBlockSchema>;

export const anthropicImageBlockSchema = z.object({
  type: z.literal("image"),
  source: z.object({
    data: z.string(),
    media_type: z.enum(["image/jpeg", "image/png", "image/gif", "image/webp"]),
    type: z.literal("base64"),
  }),
});

export type AnthropicImageBlock = z.infer<typeof anthropicImageBlockSchema>;

export const anthropicToolUseBlockSchema = anthropicToolCallSchema;

export type AnthropicToolUseBlock = z.infer<typeof anthropicToolUseBlockSchema>;

export const anthropicToolResultBlockSchema = z.object({
  type: z.literal("tool_result"),
  tool_use_id: z.string(),
  content: z.union([
    z.string(),
    z.union([anthropicTextBlockSchema, anthropicImageBlockSchema]).array(),
  ]),
  is_error: z.boolean().optional(),
});

export type AnthropicToolResultBlock = z.infer<
  typeof anthropicToolResultBlockSchema
>;

export const anthropicMessagePartSchema = z.discriminatedUnion("type", [
  anthropicTextBlockSchema,
  anthropicImageBlockSchema,
  anthropicToolUseBlockSchema,
  anthropicToolResultBlockSchema,
]);

export type AnthropicMessagePart = z.infer<typeof anthropicMessagePartSchema>;
