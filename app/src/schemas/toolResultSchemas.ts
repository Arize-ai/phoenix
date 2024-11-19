import { z } from "zod";

export const openAIToolResultMessageSchema = z.object({
  tool_call_id: z.string(),
  role: z.literal("tool"),
  content: z.string(),
});

export type OpenAIToolResultMessageSchema = z.infer<
  typeof openAIToolResultMessageSchema
>;

export const anthropicToolResultMessageSchema = z.object({
  role: z.literal("user"),
  content: z.array(
    z.object({
      type: z.literal("tool_result"),
      tool_use_id: z.string(),
      content: z.string(),
    })
  ),
});

export type AnthropicToolResultMessageSchema = z.infer<
  typeof anthropicToolResultMessageSchema
>;

export const toolResultMessageSchema = z.union([
  openAIToolResultMessageSchema,
  anthropicToolResultMessageSchema,
]);

export type AnyToolResultMessageSchema = z.infer<
  typeof toolResultMessageSchema
>;
